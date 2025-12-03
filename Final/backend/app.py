from __future__ import annotations

from typing import Any, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.flights import FlightSearchError, search_flights
from backend.tools.hotel_search_tool import get_search_tool
from backend.tools.hotel_booking_tool import get_booking_tool
from backend.core.session_store import session_store
from backend.core.llm_orchestrator import LLMOrchestrator
from backend.core.travel_mcp_router import get_travel_router
from backend.utils.logger import setup_logger

load_dotenv()

logger = setup_logger(__name__)

app = FastAPI(title='Travel Companion Backend', version='1.0.0')

# Initialize MCP components
llm_orchestrator = None
travel_router = get_travel_router()
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class FlightSearchPayload(BaseModel):
    origin: str = Field(..., min_length=1)
    destination: str = Field(..., min_length=1)
    departureDate: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    returnDate: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    maxPrice: Optional[float] = Field(None, gt=0)
    currencyCode: Optional[str] = Field(None, min_length=3, max_length=3)
    travelClass: Optional[str] = None
    nonStop: Optional[bool] = None
    tripType: Optional[str] = Field(None, pattern=r'^(one-way|round-trip)$')


class HotelSearchPayload(BaseModel):
    location: str = Field(..., min_length=1)
    checkInDate: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    checkOutDate: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    numGuests: Optional[int] = Field(None, gt=0)


class HotelBookingPayload(BaseModel):
    hotelName: str = Field(..., min_length=1)
    location: str = Field(..., min_length=1)
    checkInDate: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    checkOutDate: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    numGuests: int = Field(1, gt=0)
    roomType: str = Field("Standard")


class ChatRequest(BaseModel):
    """Request model for MCP chat endpoint."""
    session_id: str
    user_text: str


class ChatResponse(BaseModel):
    """Response model for MCP chat endpoint."""
    session_id: str
    reply: str
    intent: Optional[str] = None
    slots: Optional[dict] = None
    flights: Optional[List[Any]] = None  # Flight search results
    hotels: Optional[List[Any]] = None   # Hotel search results
    booking: Optional[dict] = None       # Hotel booking confirmation


@app.on_event("startup")
async def startup_event():
    """Initialize LLM orchestrator on startup."""
    global llm_orchestrator
    
    logger.info("Starting Travel Companion Backend...")
    
    try:
        llm_orchestrator = LLMOrchestrator()
        logger.info("✅ LLM Orchestrator initialized with AWS Bedrock/Claude")
    except Exception as e:
        logger.error(f"❌ Failed to initialize LLM Orchestrator: {e}")
        logger.warning("Server will continue but MCP chat endpoint will not work")
    
    logger.info("✅ Backend started successfully")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Shutting down Travel Companion Backend...")
    session_store.cleanup_old_sessions(max_age_hours=24)
    logger.info("✅ Shutdown complete")


@app.get('/')
async def root():
    """Root endpoint."""
    return {
        "status": "running",
        "service": "Travel Companion Backend",
        "version": "1.0.0",
        "active_sessions": session_store.get_session_count(),
        "mcp_enabled": llm_orchestrator is not None
    }


@app.get('/health')
async def health():
    return {
        'status': 'ok',
        'mcp_enabled': llm_orchestrator is not None,
        'active_sessions': session_store.get_session_count()
    }


@app.post('/api/chat', response_model=ChatResponse)
async def chat_with_mcp(request: ChatRequest):
    """
    MCP Chat endpoint - Uses AWS Bedrock/Claude with MCP pattern.
    
    Flow:
    1. Get or create session
    2. Extract intent and slots via Claude/Bedrock
    3. If LLM has direct reply, return it
    4. Otherwise, route to appropriate tool and execute
    5. Return response
    """
    try:
        logger.info(f"MCP Chat request from session {request.session_id}: {request.user_text}")
        
        # Get or create session
        session = session_store.get_or_create_session(request.session_id)
        
        # Check if LLM orchestrator is available
        if llm_orchestrator is None:
            return ChatResponse(
                session_id=request.session_id,
                reply="I apologize, but the AI system is not initialized. Please check AWS credentials.",
                intent="Error",
                slots={}
            )
        
        # Extract intent and slots using Claude/Bedrock
        llm_result = llm_orchestrator.extract_intent_and_slots(
            request.user_text,
            session
        )
        
        # Add user message to session
        session.add_message("user", request.user_text)
        
        intent = llm_result.get("intent")
        slots = llm_result.get("slots", {})
        user_reply = llm_result.get("user_reply")
        
        logger.info(f"Claude extracted - Intent: {intent}, Has Reply: {user_reply is not None}")
        
        # If Claude has a direct reply (slot-filling), return it
        if user_reply:
            session.add_message("assistant", user_reply)
            return ChatResponse(
                session_id=request.session_id,
                reply=user_reply,
                intent=intent,
                slots=slots
            )
        
        # Otherwise, route to appropriate tool via MCP router
        tool_result = await travel_router.route_and_execute(intent, slots, session)
        
        reply = tool_result.get("message", "I processed your request.")
        
        # Add assistant response to session
        session.add_message("assistant", reply)
        
        # Build response with tool data if available
        response_data = {
            "session_id": request.session_id,
            "reply": reply,
            "intent": intent,
            "slots": session.slots
        }
        
        # Include tool results (flights, hotels, booking) in response
        if tool_result.get("flights"):
            response_data["flights"] = tool_result["flights"]
        if tool_result.get("hotels"):
            response_data["hotels"] = tool_result["hotels"]
        if tool_result.get("booking"):
            response_data["booking"] = tool_result["booking"]
        
        return ChatResponse(**response_data)
        
    except Exception as e:
        logger.error(f"Error in MCP chat endpoint: {e}", exc_info=True)
        return ChatResponse(
            session_id=request.session_id,
            reply="I encountered an error. Please try again.",
            intent="Error",
            slots={}
        )


@app.post('/api/flights/search')
async def flight_search(payload: FlightSearchPayload) -> List[Any]:
    try:
        return await search_flights(
            origin=payload.origin,
            destination=payload.destination,
            departure_date=payload.departureDate,
            return_date=payload.returnDate,
            max_price=payload.maxPrice,
            currency_code=payload.currencyCode,
            travel_class=payload.travelClass,
            non_stop=payload.nonStop,
        )
    except FlightSearchError as exc:  # pragma: no cover - simple mapping
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post('/api/hotels/search')
async def hotel_search(payload: HotelSearchPayload):
    """Search for hotels in a location."""
    try:
        search_tool = get_search_tool()
        result = search_tool.execute(
            location=payload.location,
            check_in_date=payload.checkInDate,
            check_out_date=payload.checkOutDate,
            num_guests=payload.numGuests
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post('/api/hotels/book')
async def hotel_booking(payload: HotelBookingPayload):
    """Book a hotel reservation."""
    try:
        booking_tool = get_booking_tool()
        result = booking_tool.execute(
            hotel_name=payload.hotelName,
            location=payload.location,
            check_in_date=payload.checkInDate,
            check_out_date=payload.checkOutDate,
            num_guests=payload.numGuests,
            room_type=payload.roomType
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
