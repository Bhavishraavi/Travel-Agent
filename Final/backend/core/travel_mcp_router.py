"""
Travel MCP Router - Routes intents to appropriate tools (flights + hotels).
"""
from typing import Dict, Any, Callable
from backend.tools.hotel_search_tool import get_search_tool
from backend.tools.hotel_booking_tool import get_booking_tool
from backend.tools.flight_booking_tool import FlightBookingTool
from backend.flights import search_flights
from backend.core.session_store import ConversationSession
from backend.utils.logger import setup_logger

logger = setup_logger(__name__)

# Singleton flight booking tool
_flight_booking_tool = None

def get_flight_booking_tool() -> FlightBookingTool:
    """Get or create singleton flight booking tool instance."""
    global _flight_booking_tool
    if _flight_booking_tool is None:
        _flight_booking_tool = FlightBookingTool()
    return _flight_booking_tool


class TravelMCPRouter:
    """
    Routes user intents to appropriate tools (flights and hotels).
    """
    
    def __init__(self):
        """Initialize the router with tool registry."""
        # Tool registry: intent -> tool function
        self.tool_registry: Dict[str, Callable] = {
            "FlightSearch": self._route_to_flight_search,
            "FlightBooking": self._route_to_flight_booking,
            "HotelSearch": self._route_to_hotel_search,
            "HotelBooking": self._route_to_hotel_booking,
            "CancelBooking": self._route_to_cancel,
            "ModifyBooking": self._route_to_modify,
            "GeneralQuery": self._handle_general_query,
            "Greeting": self._handle_greeting,
            "Farewell": self._handle_farewell,
            "Unknown": self._handle_unknown
        }
        
        logger.info("TravelMCPRouter initialized with tool registry")
    
    async def route_and_execute(
        self,
        intent: str,
        slots: Dict[str, Any],
        session: ConversationSession
    ) -> Dict[str, Any]:
        """
        Route intent to appropriate tool and execute.
        
        Args:
            intent: Extracted intent from LLM
            slots: Extracted slots from LLM
            session: Current conversation session
        
        Returns:
            Dictionary with execution result and message
        """
        logger.info(f"Routing intent: {intent}")
        
        # Merge new slots with session slots
        merged_slots = self._merge_slots(session.slots, slots)
        
        # Update session slots
        session.update_slots(merged_slots)
        
        # Get appropriate handler
        handler = self.tool_registry.get(intent, self._handle_unknown)
        
        try:
            # Execute handler (await if it's async)
            result = handler(merged_slots, session)
            if hasattr(result, '__await__'):
                result = await result
            return result
        except Exception as e:
            logger.error(f"Error executing handler for intent {intent}: {e}")
            return {
                "success": False,
                "message": "I encountered an error processing your request. Could you please try again?"
            }
    
    def _merge_slots(
        self,
        session_slots: Dict[str, Any],
        new_slots: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Merge new slots with existing session slots."""
        merged = session_slots.copy()
        
        for key, value in new_slots.items():
            if value is not None:
                merged[key] = value
        
        return merged
    
    async def _route_to_flight_search(
        self,
        slots: Dict[str, Any],
        session: ConversationSession
    ) -> Dict[str, Any]:
        """Route to flight search."""
        logger.info("Routing to Flight Search")
        logger.info(f"📋 Extracted slots: {slots}")
        
        origin = slots.get("origin")
        destination = slots.get("destination")
        departure_date = slots.get("departure_date")
        
        if not all([origin, destination, departure_date]):
            missing = []
            if not origin: missing.append("origin city")
            if not destination: missing.append("destination city")
            if not departure_date: missing.append("departure date")
            return {
                "success": False,
                "message": f"I need the following information: {', '.join(missing)}"
            }
        
        try:
            flights = await search_flights(
                origin=origin,
                destination=destination,
                departure_date=departure_date,
                return_date=slots.get("return_date"),
                max_price=slots.get("max_price"),
                currency_code=slots.get("currency_code", "USD")
            )
            
            if flights:
                # Mark that flights have been found for context
                session.update_slots({"flights_found": True})
                
                return {
                    "success": True,
                    "message": f"I found {len(flights)} flights from {origin} to {destination}.",
                    "flights": flights
                }
            else:
                return {
                    "success": False,
                    "message": f"I couldn't find any flights from {origin} to {destination} on that date."
                }
        except Exception as e:
            logger.error(f"Flight search error: {e}")
            return {
                "success": False,
                "message": "There was an error searching for flights. Please try again."
            }
    
    async def _route_to_flight_booking(
        self,
        slots: Dict[str, Any],
        session: ConversationSession
    ) -> Dict[str, Any]:
        """Route to flight booking tool."""
        logger.info("Routing to Flight Booking")
        booking_tool = get_flight_booking_tool()
        
        # Required fields for flight booking
        airline = slots.get("airline")
        flight_number = slots.get("flight_number")
        origin = slots.get("origin")
        destination = slots.get("destination")
        departure_date = slots.get("departure_date")
        departure_time = slots.get("departure_time")
        arrival_time = slots.get("arrival_time")
        price = slots.get("price")
        
        # Check if all required fields are present
        if not all([airline, flight_number, origin, destination, departure_date, 
                    departure_time, arrival_time, price]):
            missing = []
            if not airline: missing.append("airline")
            if not flight_number: missing.append("flight number")
            if not origin: missing.append("origin")
            if not destination: missing.append("destination")
            if not departure_date: missing.append("departure date")
            if not departure_time: missing.append("departure time")
            if not arrival_time: missing.append("arrival time")
            if not price: missing.append("price")
            
            return {
                "success": False,
                "message": f"I need the following information to book the flight: {', '.join(missing)}. Which flight would you like to book?"
            }
        
        try:
            # Execute booking
            result = await booking_tool.execute(
                airline=airline,
                flight_number=flight_number,
                origin=origin,
                destination=destination,
                departure_date=departure_date,
                departure_time=departure_time,
                arrival_time=arrival_time,
                price=price,
                currency_code=slots.get("currency_code", "USD"),
                travel_class=slots.get("travel_class"),
                num_passengers=slots.get("num_passengers"),
                passenger_name=slots.get("passenger_name"),
                return_date=slots.get("return_date"),
                return_flight_number=slots.get("return_flight_number")
            )
            
            if result.get("success"):
                return {
                    "success": True,
                    "message": result["message"],
                    "booking": result["booking"]
                }
            else:
                return result
                
        except Exception as e:
            logger.error(f"Flight booking error: {e}")
            return {
                "success": False,
                "message": "There was an error booking your flight. Please try again."
            }
    
    def _route_to_hotel_search(
        self,
        slots: Dict[str, Any],
        session: ConversationSession
    ) -> Dict[str, Any]:
        """Route to hotel search tool."""
        logger.info("Routing to Hotel Search")
        search_tool = get_search_tool()
        result = search_tool.execute(
            location=slots.get("location"),
            check_in_date=slots.get("check_in_date"),
            check_out_date=slots.get("check_out_date"),
            num_guests=slots.get("num_guests")
        )
        
        # Mark that hotels have been found for context
        if result.get("success") and result.get("hotels"):
            session.update_slots({"hotels_found": True})
        
        return result
    
    def _route_to_hotel_booking(
        self,
        slots: Dict[str, Any],
        session: ConversationSession
    ) -> Dict[str, Any]:
        """Route to hotel booking tool."""
        logger.info("Routing to Hotel Booking")
        booking_tool = get_booking_tool()
        
        hotel_name = slots.get("hotel_name")
        location = slots.get("location")
        check_in_date = slots.get("check_in_date")
        check_out_date = slots.get("check_out_date")
        
        if not all([hotel_name, location, check_in_date, check_out_date]):
            missing = []
            if not hotel_name: missing.append("hotel name")
            if not location: missing.append("location")
            if not check_in_date: missing.append("check-in date")
            if not check_out_date: missing.append("check-out date")
            return {
                "success": False,
                "message": f"I need the following: {', '.join(missing)}"
            }
        
        return booking_tool.execute(
            hotel_name=hotel_name,
            location=location,
            check_in_date=check_in_date,
            check_out_date=check_out_date,
            num_guests=slots.get("num_guests", 1),
            room_type=slots.get("room_type", "Standard")
        )
    
    def _route_to_cancel(self, slots: Dict[str, Any], session: ConversationSession) -> Dict[str, Any]:
        """Handle booking cancellation."""
        return {
            "success": False,
            "message": "To cancel a booking, please provide your confirmation number."
        }
    
    def _route_to_modify(self, slots: Dict[str, Any], session: ConversationSession) -> Dict[str, Any]:
        """Handle booking modification."""
        return {
            "success": False,
            "message": "To modify a booking, please provide your confirmation number and what you'd like to change."
        }
    
    def _handle_general_query(self, slots: Dict[str, Any], session: ConversationSession) -> Dict[str, Any]:
        """Handle general queries."""
        return {
            "success": True,
            "message": "I'm here to help you search for flights and hotels, and make bookings. What would you like to do today?"
        }
    
    def _handle_greeting(self, slots: Dict[str, Any], session: ConversationSession) -> Dict[str, Any]:
        """Handle user greetings."""
        return {
            "success": True,
            "message": "Hello! Welcome to your travel assistant. I can help you search for flights and hotels, or make reservations. What are you looking for today?"
        }
    
    def _handle_farewell(self, slots: Dict[str, Any], session: ConversationSession) -> Dict[str, Any]:
        """Handle farewell."""
        return {
            "success": True,
            "message": "You're welcome! Thank you for using our travel service. Have a wonderful day and safe travels! 👋"
        }
    
    def _handle_unknown(self, slots: Dict[str, Any], session: ConversationSession) -> Dict[str, Any]:
        """Handle unknown intent."""
        return {
            "success": False,
            "message": "I'm not sure I understand. Would you like to search for flights, search for hotels, or make a booking?"
        }


# Singleton instance
_router_instance = None


def get_travel_router() -> TravelMCPRouter:
    """Get or create singleton router instance."""
    global _router_instance
    if _router_instance is None:
        _router_instance = TravelMCPRouter()
    return _router_instance

