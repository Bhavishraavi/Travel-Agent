"""
Wrapper for Google Places API to search for Marriott hotels.
"""
import requests
from typing import List, Dict, Optional
from backend.utils.logger import setup_logger

logger = setup_logger(__name__)


class GooglePlacesClient:
    """
    Client for interacting with Google Places API.
    Searches for hotels and filters by Marriott brands.
    """
    
    BASE_URL = "https://maps.googleapis.com/maps/api/place"
    
    # Marriott brand keywords for filtering
    MARRIOTT_BRANDS = [
        "marriott", "courtyard", "residence inn", "fairfield inn",
        "springhill suites", "towneplace suites", "jw marriott",
        "ritz-carlton", "ritz carlton", "w hotel", "westin",
        "sheraton", "le meridien", "st. regis", "luxury collection",
        "autograph collection", "delta hotels", "aloft", "element",
        "four points", "moxy"
    ]
    
    def __init__(self, api_key: str):
        """
        Initialize the Google Places client.
        
        Args:
            api_key: Google Places API key
        """
        self.api_key = api_key
        
    def search_marriott_hotels(
        self,
        location: str,
        radius: int = 5000,
        max_results: int = 5
    ) -> List[Dict]:
        """
        Search for Marriott hotels near a location.
        
        Args:
            location: City or address to search near
            radius: Search radius in meters (default: 5000m = 5km)
            max_results: Maximum number of results to return
        
        Returns:
            List of hotel dictionaries with name, address, rating, etc.
        """
        logger.info(f"Searching Marriott hotels near: {location}")
        
        try:
            # Step 1: Geocode the location to get lat/lng
            lat, lng = self._geocode_location(location)
            if not lat or not lng:
                logger.error(f"Could not geocode location: {location}")
                return []
            
            # Step 2: Search for hotels using Places API
            hotels = self._search_nearby_hotels(lat, lng, radius)
            
            # Step 3: Filter for Marriott brands
            marriott_hotels = self._filter_marriott_hotels(hotels)
            
            # Step 4: Limit results
            return marriott_hotels[:max_results]
            
        except Exception as e:
            logger.error(f"Error searching hotels: {e}")
            return []
    
    def _geocode_location(self, location: str) -> tuple:
        """
        Convert location string to lat/lng coordinates.
        
        Args:
            location: City or address string
        
        Returns:
            Tuple of (latitude, longitude)
        """
        url = f"{self.BASE_URL}/../geocode/json"
        params = {
            "address": location,
            "key": self.api_key
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") == "OK" and data.get("results"):
                coords = data["results"][0]["geometry"]["location"]
                logger.info(f"Geocoded {location} -> {coords['lat']}, {coords['lng']}")
                return coords["lat"], coords["lng"]
            else:
                status = data.get('status')
                logger.warning(f"Geocoding failed: {status}")
                if status == "REQUEST_DENIED":
                    logger.error("Google Places API access denied. Please enable Geocoding API and Places API in Google Cloud Console.")
                return None, None
                
        except Exception as e:
            logger.error(f"Geocoding error: {e}")
            return None, None
    
    def _search_nearby_hotels(self, lat: float, lng: float, radius: int) -> List[Dict]:
        """
        Search for hotels near coordinates using Places API.
        
        Args:
            lat: Latitude
            lng: Longitude
            radius: Search radius in meters
        
        Returns:
            List of hotel results
        """
        url = f"{self.BASE_URL}/nearbysearch/json"
        params = {
            "location": f"{lat},{lng}",
            "radius": radius,
            "type": "lodging",
            "key": self.api_key
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") == "OK":
                logger.info(f"Found {len(data.get('results', []))} hotels")
                return data.get("results", [])
            else:
                logger.warning(f"Places search failed: {data.get('status')}")
                return []
                
        except Exception as e:
            logger.error(f"Places search error: {e}")
            return []
    
    def _filter_marriott_hotels(self, hotels: List[Dict]) -> List[Dict]:
        """
        Filter hotels to only include Marriott brands.
        
        Args:
            hotels: List of hotel results from Places API
        
        Returns:
            Filtered list containing only Marriott properties
        """
        marriott_hotels = []
        
        for hotel in hotels:
            name = hotel.get("name", "").lower()
            
            # Check if any Marriott brand keyword is in the hotel name
            is_marriott = any(brand in name for brand in self.MARRIOTT_BRANDS)
            
            if is_marriott:
                marriott_hotels.append({
                    "name": hotel.get("name"),
                    "address": hotel.get("vicinity"),
                    "rating": hotel.get("rating"),
                    "user_ratings_total": hotel.get("user_ratings_total"),
                    "place_id": hotel.get("place_id"),
                    "location": hotel.get("geometry", {}).get("location", {})
                })
        
        logger.info(f"Filtered to {len(marriott_hotels)} Marriott properties")
        return marriott_hotels
    
    def get_place_details(self, place_id: str) -> Optional[Dict]:
        """
        Get detailed information about a specific place.
        
        Args:
            place_id: Google Places ID
        
        Returns:
            Dictionary with place details
        """
        url = f"{self.BASE_URL}/details/json"
        params = {
            "place_id": place_id,
            "fields": "name,formatted_address,formatted_phone_number,rating,website,reviews",
            "key": self.api_key
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") == "OK":
                return data.get("result", {})
            else:
                logger.warning(f"Place details failed: {data.get('status')}")
                return None
                
        except Exception as e:
            logger.error(f"Place details error: {e}")
            return None

