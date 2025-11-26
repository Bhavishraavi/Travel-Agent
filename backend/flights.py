"""Flight search utilities backed by the Amadeus API."""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any, Dict, List, Tuple

import httpx
from dotenv import load_dotenv

load_dotenv()

AMADEUS_API_BASE = os.getenv('AMADEUS_API_BASE', 'https://test.api.amadeus.com')
AMADEUS_CLIENT_ID = os.getenv('AMADEUS_CLIENT_ID')
AMADEUS_CLIENT_SECRET = os.getenv('AMADEUS_CLIENT_SECRET')
TOKEN_REFRESH_BUFFER = int(os.getenv('AMADEUS_TOKEN_BUFFER_SECONDS', '300'))


class FlightSearchError(Exception):
    """Raised when the Amadeus-backed flight search fails."""


_token_cache: Dict[str, Any] = {
    'token': None,
    'expiry': 0.0,
}


async def _get_amadeus_token(client: httpx.AsyncClient) -> str:
    if not AMADEUS_CLIENT_ID or not AMADEUS_CLIENT_SECRET:
        raise FlightSearchError('Amadeus credentials are not configured.')

    now = time.time()
    cached_token = _token_cache.get('token')
    if cached_token and now < _token_cache.get('expiry', 0):
        return cached_token

    data = {
        'grant_type': 'client_credentials',
        'client_id': AMADEUS_CLIENT_ID,
        'client_secret': AMADEUS_CLIENT_SECRET,
    }

    response = await client.post(
        f'{AMADEUS_API_BASE}/v1/security/oauth2/token',
        data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        timeout=20.0,
    )
    if response.status_code >= 400:
        raise FlightSearchError('Unable to fetch Amadeus access token.')

    payload = response.json()
    expires_in = int(payload.get('expires_in', 0))
    expiry = now + max(0, expires_in - TOKEN_REFRESH_BUFFER)
    _token_cache.update({'token': payload.get('access_token'), 'expiry': expiry})
    if not _token_cache['token']:
        raise FlightSearchError('Amadeus token response was missing an access token.')
    return _token_cache['token']


async def _resolve_iata(city: str, token: str, client: httpx.AsyncClient) -> str:
    response = await client.get(
        f'{AMADEUS_API_BASE}/v1/reference-data/locations',
        params={'subType': 'CITY', 'keyword': city},
        headers={'Authorization': f'Bearer {token}'},
        timeout=20.0,
    )
    if response.status_code >= 400:
        raise FlightSearchError(f'Failed to resolve IATA code for {city}.')

    payload = response.json()
    matches = payload.get('data', [])
    if not matches:
        raise FlightSearchError(f'No airport matches were found for {city}.')
    return matches[0]['iataCode']


async def _fetch_flight_offers(
    origin_iata: str,
    destination_iata: str,
    departure_date: str,
    token: str,
    client: httpx.AsyncClient,
    *,
    return_date: str | None = None,
    max_price: float | None = None,
    currency_code: str | None = None,
    travel_class: str | None = None,
    non_stop: bool | None = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    params = {
        'originLocationCode': origin_iata,
        'destinationLocationCode': destination_iata,
        'departureDate': departure_date,
        'adults': '1',
        'max': '5',
    }
    if return_date:
        params['returnDate'] = return_date
    if max_price is not None:
        params['maxPrice'] = str(int(round(max_price)))
    if currency_code:
        params['currencyCode'] = currency_code.upper()
    if travel_class:
        params['travelClass'] = travel_class.upper()
    if non_stop is not None:
        params['nonStop'] = 'true' if non_stop else 'false'
    response = await client.get(
        f'{AMADEUS_API_BASE}/v2/shopping/flight-offers',
        params=params,
        headers={'Authorization': f'Bearer {token}'},
        timeout=30.0,
    )
    if response.status_code >= 400:
        detail = response.text
        raise FlightSearchError(f'Flight search failed: {detail}')

    payload = response.json()
    return payload.get('data', []), payload.get('dictionaries', {})


def _inject_carrier_metadata(offers: List[Dict[str, Any]], dictionaries: Dict[str, Any]) -> List[Dict[str, Any]]:
    carriers = dictionaries.get('carriers', {}) or {}
    enriched: List[Dict[str, Any]] = []
    for offer in offers:
        carrier_code = (
            offer.get('itineraries', [{}])[0]
            .get('segments', [{}])[0]
            .get('carrierCode')
        )
        label = carriers.get(carrier_code, carrier_code)
        copy = dict(offer)
        copy['carrierCode'] = label
        enriched.append(copy)
    return enriched


async def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str | None = None,
    max_price: float | None = None,
    currency_code: str | None = None,
    travel_class: str | None = None,
    non_stop: bool | None = None,
) -> List[Dict[str, Any]]:
    """Search for flights using Amadeus and return the offers."""
    async with httpx.AsyncClient() as client:
        token = await _get_amadeus_token(client)
        origin_iata, destination_iata = await asyncio.gather(
            _resolve_iata(origin, token, client),
            _resolve_iata(destination, token, client),
        )
        offers, dictionaries = await _fetch_flight_offers(
            origin_iata,
            destination_iata,
            departure_date,
            token,
            client,
            return_date=return_date,
            max_price=max_price,
            currency_code=currency_code,
            travel_class=travel_class,
            non_stop=non_stop,
        )
        return _inject_carrier_metadata(offers, dictionaries)
