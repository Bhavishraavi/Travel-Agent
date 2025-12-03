"""
In-memory session store for managing conversation context and slots.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime
from backend.utils.logger import setup_logger

logger = setup_logger(__name__)


class ConversationSession:
    """
    Represents a single user conversation session.
    Stores conversation history, extracted slots, and metadata.
    """
    
    def __init__(self, session_id: str):
        """
        Initialize a new conversation session.
        
        Args:
            session_id: Unique identifier for this session
        """
        self.session_id = session_id
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        
        # Conversation history: list of {role, content} messages
        self.messages: List[Dict[str, str]] = []
        
        # Extracted slots for booking/search (flights + hotels)
        self.slots: Dict[str, Any] = {
            # Hotel slots
            "location": None,
            "check_in_date": None,
            "check_out_date": None,
            "num_guests": None,
            "room_type": None,
            "hotel_name": None,
            "hotels_found": None,
            # Flight search slots
            "origin": None,
            "destination": None,
            "departure_date": None,
            "return_date": None,
            "max_price": None,
            "currency_code": "USD",
            "travel_class": None,
            "non_stop": None,
            "flights_found": None,
            # Flight booking slots
            "airline": None,
            "flight_number": None,
            "departure_time": None,
            "arrival_time": None,
            "price": None,
            "num_passengers": None,
            "passenger_name": None,
            "return_flight_number": None,
            # Common
            "intent": None
        }
        
        # Track last intent for context
        self.last_intent: Optional[str] = None
    
    def add_message(self, role: str, content: str):
        """
        Add a message to conversation history.
        
        Args:
            role: Message role (user/assistant)
            content: Message content
        """
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })
        self.last_activity = datetime.now()
        logger.debug(f"Session {self.session_id}: Added {role} message")
    
    def update_slots(self, new_slots: Dict[str, Any]):
        """
        Update session slots with new values.
        Only updates non-None values to preserve existing data.
        
        Args:
            new_slots: Dictionary of slot updates
        """
        for key, value in new_slots.items():
            if value is not None:
                self.slots[key] = value
                logger.debug(f"Session {self.session_id}: Updated slot {key}={value}")
        
        self.last_activity = datetime.now()
    
    def get_slot(self, key: str) -> Any:
        """
        Get a specific slot value.
        
        Args:
            key: Slot name
        
        Returns:
            Slot value or None if not set
        """
        return self.slots.get(key)
    
    def clear_slots(self):
        """Clear all slot values (for new conversation flow)."""
        self.slots = {key: None for key in self.slots}
        logger.info(f"Session {self.session_id}: Slots cleared")
    
    def get_conversation_history(self, max_messages: int = 10) -> List[Dict]:
        """
        Get recent conversation history.
        
        Args:
            max_messages: Maximum number of messages to return
        
        Returns:
            List of recent messages
        """
        return self.messages[-max_messages:]
    
    def to_dict(self) -> Dict:
        """Convert session to dictionary for serialization."""
        return {
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "messages": self.messages,
            "slots": self.slots,
            "last_intent": self.last_intent
        }


class SessionStore:
    """
    In-memory store for managing multiple conversation sessions.
    """
    
    def __init__(self):
        """Initialize the session store."""
        self.sessions: Dict[str, ConversationSession] = {}
        logger.info("SessionStore initialized")
    
    def create_session(self, session_id: str) -> ConversationSession:
        """
        Create a new conversation session.
        
        Args:
            session_id: Unique identifier for the session
        
        Returns:
            New ConversationSession instance
        """
        session = ConversationSession(session_id)
        self.sessions[session_id] = session
        logger.info(f"Created new session: {session_id}")
        return session
    
    def get_session(self, session_id: str) -> Optional[ConversationSession]:
        """
        Get an existing session or None if not found.
        
        Args:
            session_id: Session identifier
        
        Returns:
            ConversationSession or None
        """
        return self.sessions.get(session_id)
    
    def get_or_create_session(self, session_id: str) -> ConversationSession:
        """
        Get existing session or create new one if doesn't exist.
        
        Args:
            session_id: Session identifier
        
        Returns:
            ConversationSession instance
        """
        session = self.get_session(session_id)
        if session is None:
            session = self.create_session(session_id)
        return session
    
    def delete_session(self, session_id: str):
        """
        Delete a session from the store.
        
        Args:
            session_id: Session identifier
        """
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Deleted session: {session_id}")
    
    def cleanup_old_sessions(self, max_age_hours: int = 24):
        """
        Remove sessions older than specified age.
        
        Args:
            max_age_hours: Maximum session age in hours
        """
        now = datetime.now()
        expired_sessions = []
        
        for session_id, session in self.sessions.items():
            age_hours = (now - session.last_activity).total_seconds() / 3600
            if age_hours > max_age_hours:
                expired_sessions.append(session_id)
        
        for session_id in expired_sessions:
            self.delete_session(session_id)
        
        if expired_sessions:
            logger.info(f"Cleaned up {len(expired_sessions)} expired sessions")
    
    def get_session_count(self) -> int:
        """Get total number of active sessions."""
        return len(self.sessions)


# Global session store instance
session_store = SessionStore()


