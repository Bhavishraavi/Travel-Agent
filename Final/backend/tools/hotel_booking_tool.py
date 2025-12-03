"""
Hotel Booking Tool - Mock booking API for hotel reservations.
"""
import uuid
from datetime import datetime
from typing import Dict, Any
from backend.utils.logger import setup_logger

logger = setup_logger(__name__)


class HotelBookingTool:
    """
    Tool for booking hotel reservations.
    This is a mock implementation that validates inputs and returns confirmation.
    """
    
    def __init__(self):
        """Initialize the booking tool."""
        logger.info("HotelBookingTool initialized")
        # In-memory storage for mock bookings
        self.bookings: Dict[str, Dict] = {}
    
    def execute(self, hotel_name: str, location: str, check_in_date: str, 
                check_out_date: str, num_guests: int = None, room_type: str = None) -> Dict[str, Any]:
        """
        Execute hotel booking based on provided parameters.
        
        Args:
            hotel_name: Name of the hotel
            location: Hotel location
            check_in_date: Check-in date
            check_out_date: Check-out date
            num_guests: Number of guests
            room_type: Type of room
        
        Returns:
            Dictionary with booking confirmation or error message
        """
        logger.info("=" * 60)
        logger.info("🔧 TOOL CALLED: HOTEL BOOKING")
        logger.info(f"🏨 Hotel: {hotel_name}")
        logger.info(f"📍 Location: {location}")
        logger.info(f"📅 Check-in: {check_in_date}")
        logger.info(f"📅 Check-out: {check_out_date}")
        logger.info(f"👥 Guests: {num_guests}")
        logger.info(f"🛏️  Room Type: {room_type}")
        logger.info("=" * 60)
        
        # Set defaults for optional parameters
        if num_guests is None:
            num_guests = 1
            logger.info(f"   (Setting default: num_guests = 1)")
        if room_type is None:
            room_type = "Standard"
            logger.info(f"   (Setting default: room_type = 'Standard')")
        
        # Validate required parameters
        validation_result = self._validate_params(hotel_name, location, check_in_date, check_out_date)
        if not validation_result["valid"]:
            return {
                "success": False,
                "message": validation_result["message"]
            }
        
        # Create booking
        booking = self._create_booking(hotel_name, location, check_in_date, check_out_date, 
                                      num_guests, room_type)
        
        # Store booking
        self.bookings[booking["confirmation_number"]] = booking
        
        logger.info(f"Booking created: {booking['confirmation_number']}")
        
        return {
            "success": True,
            "message": "Booking confirmed successfully!",
            "booking": booking
        }
    
    def _validate_params(self, hotel_name: str, location: str, check_in_date: str, 
                        check_out_date: str) -> Dict[str, Any]:
        """
        Validate that all required booking information is present.
        
        Args:
            hotel_name: Hotel name
            location: Location
            check_in_date: Check-in date
            check_out_date: Check-out date
        
        Returns:
            Dictionary with 'valid' (bool) and 'message' (str)
        """
        missing_fields = []
        
        if not hotel_name:
            missing_fields.append("hotel name")
        if not location:
            missing_fields.append("location")
        if not check_in_date:
            missing_fields.append("check-in date")
        if not check_out_date:
            missing_fields.append("check-out date")
        
        if missing_fields:
            fields_str = ", ".join(missing_fields)
            return {
                "valid": False,
                "message": f"I need the following information to complete your booking: {fields_str}. Could you provide that?"
            }
        
        return {
            "valid": True,
            "message": "All required fields present"
        }
    
    def _create_booking(self, hotel_name: str, location: str, check_in_date: str, 
                       check_out_date: str, num_guests: int, room_type: str) -> Dict[str, Any]:
        """
        Create a booking record.
        
        Args:
            hotel_name: Hotel name
            location: Location
            check_in_date: Check-in date
            check_out_date: Check-out date
            num_guests: Number of guests
            room_type: Room type
        
        Returns:
            Booking dictionary with confirmation details
        """
        confirmation_number = self._generate_confirmation_number()
        
        booking = {
            "confirmation_number": confirmation_number,
            "hotel_name": hotel_name,
            "location": location,
            "check_in_date": check_in_date,
            "check_out_date": check_out_date,
            "num_guests": num_guests,
            "room_type": room_type,
            "status": "confirmed",
            "booked_at": datetime.now().isoformat(),
            "total_price": self._calculate_price(num_guests, room_type)
        }
        
        return booking
    
    def _generate_confirmation_number(self) -> str:
        """
        Generate a unique confirmation number.
        
        Returns:
            Confirmation number string
        """
        # Format: HTL-XXXXXX (6 uppercase alphanumeric)
        unique_id = str(uuid.uuid4())[:6].upper()
        return f"HTL-{unique_id}"
    
    def _calculate_price(self, num_guests: int, room_type: str) -> float:
        """
        Calculate mock booking price.
        
        Args:
            num_guests: Number of guests
            room_type: Room type
        
        Returns:
            Total price
        """
        # Base price per night
        base_price = 150.0
        
        # Room type multiplier
        if room_type:  # Check if room_type is not None
            room_type_lower = room_type.lower()
            if "suite" in room_type_lower or "deluxe" in room_type_lower:
                base_price *= 1.5
        
        # Number of guests multiplier
        if num_guests and num_guests > 2:  # Check for None first
            base_price *= 1.2
        
        # Calculate for 3 nights (simplified)
        num_nights = 3
        total_price = base_price * num_nights
        
        return round(total_price, 2)
    
    def get_booking(self, confirmation_number: str) -> Dict[str, Any]:
        """
        Retrieve a booking by confirmation number.
        
        Args:
            confirmation_number: Booking confirmation number
        
        Returns:
            Booking dictionary or None if not found
        """
        return self.bookings.get(confirmation_number)
    
    def cancel_booking(self, confirmation_number: str) -> Dict[str, Any]:
        """
        Cancel a booking.
        
        Args:
            confirmation_number: Booking confirmation number
        
        Returns:
            Dictionary with success status and message
        """
        booking = self.bookings.get(confirmation_number)
        
        if not booking:
            return {
                "success": False,
                "message": f"I couldn't find a booking with confirmation number {confirmation_number}. Please check the number and try again."
            }
        
        # Update status
        booking["status"] = "cancelled"
        booking["cancelled_at"] = datetime.now().isoformat()
        
        logger.info(f"Booking cancelled: {confirmation_number}")
        
        return {
            "success": True,
            "message": f"Your booking (confirmation number: {confirmation_number}) has been successfully cancelled."
        }


# Singleton instance
_booking_tool_instance = None


def get_booking_tool() -> HotelBookingTool:
    """Get or create singleton booking tool instance."""
    global _booking_tool_instance
    if _booking_tool_instance is None:
        _booking_tool_instance = HotelBookingTool()
    return _booking_tool_instance

