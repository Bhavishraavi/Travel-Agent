from __future__ import annotations

from typing import Any, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.flights import FlightSearchError, search_flights

load_dotenv()

app = FastAPI(title='Travel Companion Backend', version='1.0.0')
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
    returnDate: str | None = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    maxPrice: float | None = Field(None, gt=0)
    currencyCode: str | None = Field(None, min_length=3, max_length=3)
    travelClass: str | None = None
    nonStop: bool | None = None
    tripType: str | None = Field(None, pattern=r'^(one-way|round-trip)$')


@app.get('/health')
async def health() -> dict[str, str]:
    return {'status': 'ok'}


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
