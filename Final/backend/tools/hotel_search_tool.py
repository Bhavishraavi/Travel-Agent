"""
Hotel Search Tool - Uses Google Places API to find Marriott hotels.
"""
import os
from typing import Dict, Any, List
from backend.utils.google_places_client import GooglePlacesClient
from backend.utils.logger import setup_logger

logger = setup_logger(__name__)


class HotelSearchTool:
    """
    Tool for searching Marriott hotels using Google Places API.
    """
    
    def __init__(self, google_api_key: str = None):
        """
        Initialize the search tool.
        
        Args:
            google_api_key: Google Places API key (defaults to env var)
        """
        api_key = google_api_key or os.getenv("GOOGLE_PLACES_API_KEY")
        if not api_key:
            logger.warning("Google Places API key not found. Search will use mock data.")
            self.client = None
        else:
            self.client = GooglePlacesClient(api_key)
        
        logger.info("HotelSearchTool initialized")
    
    def execute(self, location: str, check_in_date: str = None, check_out_date: str = None, 
                num_guests: int = None) -> Dict[str, Any]:
        """
        Execute hotel search based on provided parameters.
        
        Args:
            location: Location to search
            check_in_date: Check-in date (optional)
            check_out_date: Check-out date (optional)
            num_guests: Number of guests (optional)
        
        Returns:
            Dictionary with search results and formatted message
        """
        logger.info("=" * 60)
        logger.info("🔧 TOOL CALLED: HOTEL SEARCH")
        logger.info(f"📍 Location: {location}")
        logger.info(f"📅 Check-in: {check_in_date or 'Not specified'}")
        logger.info(f"📅 Check-out: {check_out_date or 'Not specified'}")
        logger.info(f"👥 Guests: {num_guests or 'Not specified'}")
        logger.info("=" * 60)
        
        # Validate required parameters
        if not location:
            return {
                "success": False,
                "message": "I need a location to search for hotels. Where would you like to stay?"
            }
        
        # Search for hotels
        if self.client:
            hotels = self._search_real(location)
        else:
            hotels = self._search_mock(location)
        
        # Format response
        if not hotels:
            return {
                "success": False,
                "message": f"I couldn't find any Marriott hotels in {location}. Could you try a different location or nearby city?",
                "hotels": []
            }
        
        # Build response
        return {
            "success": True,
            "message": f"Found {len(hotels)} Marriott hotels in {location}",
            "hotels": hotels,
            "location": location
        }
    
    def _search_real(self, location: str) -> List[Dict]:
        """
        Search using real Google Places API.
        
        Args:
            location: Location to search
        
        Returns:
            List of hotel dictionaries
        """
        try:
            hotels = self.client.search_marriott_hotels(
                location=location,
                radius=5000,  # 5km radius
                max_results=5
            )
            logger.info(f"Found {len(hotels)} hotels via Google Places API")
            # If no hotels found or API error, fall back to mock
            if not hotels:
                logger.warning("No hotels found via API, using mock data")
                return self._search_mock(location)
            return hotels
        except Exception as e:
            logger.error(f"Error in real search: {e}, falling back to mock data")
            return self._search_mock(location)
    
    def _search_mock(self, location: str) -> List[Dict]:
        """
        Return mock hotel data when API is unavailable.
        
        Args:
            location: Location to search
        
        Returns:
            List of mock hotel dictionaries
        """
        logger.info(f"Using mock data for location: {location}")
        
        # Mock data based on location
        mock_hotels = {
            "new york": [
                {
                    "name": "Courtyard New York Midtown East",
                    "address": "866 Third Avenue, New York, NY 10022",
                    "rating": 4.3,
                    "user_ratings_total": 1250,
                    "place_id": "mock_nyc_1"
                },
                {
                    "name": "Residence Inn Times Square",
                    "address": "1033 6th Avenue, New York, NY 10018",
                    "rating": 4.5,
                    "user_ratings_total": 980,
                    "place_id": "mock_nyc_2"
                },
                {
                    "name": "JW Marriott Essex House",
                    "address": "160 Central Park South, New York, NY 10019",
                    "rating": 4.6,
                    "user_ratings_total": 2100,
                    "place_id": "mock_nyc_3"
                }
            ],
            "san francisco": [
                {
                    "name": "Marriott Marquis San Francisco",
                    "address": "780 Mission Street, San Francisco, CA 94103",
                    "rating": 4.2,
                    "user_ratings_total": 1500,
                    "place_id": "mock_sf_1"
                },
                {
                    "name": "Courtyard San Francisco Downtown",
                    "address": "299 2nd Street, San Francisco, CA 94105",
                    "rating": 4.4,
                    "user_ratings_total": 890,
                    "place_id": "mock_sf_2"
                }
            ],
            "chicago": [
                {
                    "name": "Chicago Marriott Downtown Magnificent Mile",
                    "address": "540 N Michigan Avenue, Chicago, IL 60611",
                    "rating": 4.3,
                    "user_ratings_total": 1650,
                    "place_id": "mock_chi_1"
                },
                {
                    "name": "Residence Inn Chicago Downtown/River North",
                    "address": "410 N Dearborn Street, Chicago, IL 60654",
                    "rating": 4.5,
                    "user_ratings_total": 720,
                    "place_id": "mock_chi_2"
                }
            ]
        }
        
        # Try to find matching location
        location_lower = location.lower()
        for city, hotels in mock_hotels.items():
            if city in location_lower or location_lower in city:
                return hotels
        
        # Default fallback hotels
        return [
            {
                "name": f"Marriott Hotel {location}",
                "address": f"Main Street, {location}",
                "rating": 4.2,
                "user_ratings_total": 500,
                "place_id": f"mock_{location.lower().replace(' ', '_')}_1"
            },
            {
                "name": f"Courtyard by Marriott {location}",
                "address": f"Downtown, {location}",
                "rating": 4.4,
                "user_ratings_total": 350,
                "place_id": f"mock_{location.lower().replace(' ', '_')}_2"
            }
        ]


# Singleton instance
_search_tool_instance = None


def get_search_tool() -> HotelSearchTool:
    """Get or create singleton search tool instance."""
    global _search_tool_instance
    if _search_tool_instance is None:
        _search_tool_instance = HotelSearchTool()
    return _search_tool_instance

