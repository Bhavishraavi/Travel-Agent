"""
Flight Booking Tool - Mock Implementation

This tool provides mock flight booking capabilities for the travel agent.
All bookings are simulated and do not connect to real airline systems.
"""

import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class FlightBookingTool:
    """
    Mock flight booking tool for demonstration purposes.
    """
    
    def __init__(self):
        """Initialize the flight booking tool."""
        self.bookings: Dict[str, Dict[str, Any]] = {}
        logger.info("FlightBookingTool initialized")
    
    async def execute(
        self,
        airline: str,
        flight_number: str,
        origin: str,
        destination: str,
        departure_date: str,
        departure_time: str,
        arrival_time: str,
        price: float,
        currency_code: str = "USD",
        travel_class: Optional[str] = None,
        num_passengers: Optional[int] = None,
        passenger_name: Optional[str] = None,
        return_date: Optional[str] = None,
        return_flight_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute mock flight booking.
        
        Args:
            airline: Airline name
            flight_number: Flight number (e.g., "AA123")
            origin: Origin airport/city
            destination: Destination airport/city
            departure_date: Departure date (YYYY-MM-DD)
            departure_time: Departure time
            arrival_time: Arrival time
            price: Total price
            currency_code: Currency code (default: USD)
            travel_class: Travel class (ECONOMY, BUSINESS, FIRST)
            num_passengers: Number of passengers
            passenger_name: Primary passenger name
            return_date: Return date for round trip
            return_flight_number: Return flight number
        
        Returns:
            Dictionary with booking confirmation
        """
        logger.info("🔧 TOOL CALLED: FLIGHT BOOKING")
        logger.info("=" * 60)
        logger.info(f"✈️  Airline: {airline}")
        logger.info(f"🔢 Flight: {flight_number}")
        logger.info(f"📍 Route: {origin} → {destination}")
        logger.info(f"📅 Departure: {departure_date} at {departure_time}")
        logger.info(f"🕐 Arrival: {arrival_time}")
        logger.info(f"💰 Price: {currency_code} {price}")
        logger.info(f"🎫 Class: {travel_class if travel_class else 'Not specified'}")
        logger.info(f"👥 Passengers: {num_passengers if num_passengers else 'Not specified'}")
        logger.info(f"👤 Name: {passenger_name if passenger_name else 'Not specified'}")
        if return_date:
            logger.info(f"🔄 Return: {return_date} (Flight {return_flight_number})")
        logger.info("=" * 60)
        
        # Set defaults for optional parameters
        if num_passengers is None:
            num_passengers = 1
            logger.info(f"   (Setting default: num_passengers = 1)")
        if travel_class is None:
            travel_class = "ECONOMY"
            logger.info(f"   (Setting default: travel_class = 'ECONOMY')")
        if passenger_name is None:
            passenger_name = "Traveler"
            logger.info(f"   (Setting default: passenger_name = 'Traveler')")
        
        # Validate required parameters
        validation_result = self._validate_params(
            airline, flight_number, origin, destination, 
            departure_date, departure_time, arrival_time, price
        )
        if not validation_result["valid"]:
            return {
                "success": False,
                "message": validation_result["message"]
            }
        
        # Create booking
        booking = self._create_booking(
            airline, flight_number, origin, destination,
            departure_date, departure_time, arrival_time,
            price, currency_code, travel_class, num_passengers,
            passenger_name, return_date, return_flight_number
        )
        
        # Store booking
        self.bookings[booking["confirmation_number"]] = booking
        
        logger.info(f"✅ Flight booking created: {booking['confirmation_number']}")
        
        return {
            "success": True,
            "message": "Flight booking confirmed successfully!",
            "booking": booking
        }
    
    def _validate_params(
        self, airline: str, flight_number: str, origin: str, 
        destination: str, departure_date: str, departure_time: str,
        arrival_time: str, price: float
    ) -> Dict[str, Any]:
        """
        Validate that all required booking information is present.
        
        Args:
            airline: Airline name
            flight_number: Flight number
            origin: Origin airport/city
            destination: Destination airport/city
            departure_date: Departure date
            departure_time: Departure time
            arrival_time: Arrival time
            price: Price
        
        Returns:
            Dictionary with 'valid' (bool) and 'message' (str)
        """
        missing_fields = []
        
        if not airline:
            missing_fields.append("airline name")
        if not flight_number:
            missing_fields.append("flight number")
        if not origin:
            missing_fields.append("origin")
        if not destination:
            missing_fields.append("destination")
        if not departure_date:
            missing_fields.append("departure date")
        if not departure_time:
            missing_fields.append("departure time")
        if not arrival_time:
            missing_fields.append("arrival time")
        if not price:
            missing_fields.append("price")
        
        if missing_fields:
            fields_str = ", ".join(missing_fields)
            return {
                "valid": False,
                "message": f"I need the following information to complete your flight booking: {fields_str}. Could you provide that?"
            }
        
        return {
            "valid": True,
            "message": "All required fields present"
        }
    
    def _create_booking(
        self, airline: str, flight_number: str, origin: str, 
        destination: str, departure_date: str, departure_time: str,
        arrival_time: str, price: float, currency_code: str,
        travel_class: str, num_passengers: int, passenger_name: str,
        return_date: Optional[str], return_flight_number: Optional[str]
    ) -> Dict[str, Any]:
        """
        Create a booking record.
        
        Args:
            All flight details
        
        Returns:
            Booking dictionary with confirmation details
        """
        confirmation_number = self._generate_confirmation_number()
        
        booking = {
            "confirmation_number": confirmation_number,
            "airline": airline,
            "flight_number": flight_number,
            "origin": origin,
            "destination": destination,
            "departure_date": departure_date,
            "departure_time": departure_time,
            "arrival_time": arrival_time,
            "price": price,
            "currency_code": currency_code,
            "travel_class": travel_class,
            "num_passengers": num_passengers,
            "passenger_name": passenger_name,
            "status": "confirmed",
            "booked_at": datetime.now().isoformat()
        }
        
        # Add return flight info if round trip
        if return_date:
            booking["return_date"] = return_date
            booking["return_flight_number"] = return_flight_number
            booking["trip_type"] = "round-trip"
        else:
            booking["trip_type"] = "one-way"
        
        return booking
    
    def _generate_confirmation_number(self) -> str:
        """
        Generate a unique confirmation number.
        
        Returns:
            Confirmation number string
        """
        # Format: FLT-XXXXXX (6 uppercase alphanumeric)
        unique_id = str(uuid.uuid4())[:6].upper()
        return f"FLT-{unique_id}"
    
    def get_booking(self, confirmation_number: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a booking by confirmation number.
        
        Args:
            confirmation_number: Confirmation number
        
        Returns:
            Booking dictionary or None if not found
        """
        return self.bookings.get(confirmation_number)
    
    def list_bookings(self) -> list[Dict[str, Any]]:
        """
        List all bookings.
        
        Returns:
            List of all booking dictionaries
        """
        return list(self.bookings.values())

