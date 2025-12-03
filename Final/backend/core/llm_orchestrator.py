"""
LLM Orchestrator for handling Claude Bedrock calls and intent extraction.
"""
import json
import os
from typing import Dict, List, Any, Optional
import boto3
from botocore.exceptions import ClientError
from backend.core.session_store import ConversationSession
from backend.utils.logger import setup_logger

logger = setup_logger(__name__)


class LLMOrchestrator:
    """
    Handles interactions with Claude via Amazon Bedrock.
    Extracts intent and slots from user messages.
    """
    
    # Default model ID for Claude 3
    DEFAULT_MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0"
    
    def __init__(
        self,
        model_id: Optional[str] = None,
        region_name: str = "us-east-1"
    ):
        """
        Initialize the LLM orchestrator.
        
        Args:
            model_id: Bedrock model ID (defaults to Claude 3 Sonnet)
            region_name: AWS region for Bedrock
        """
        self.model_id = model_id or self.DEFAULT_MODEL_ID
        self.region_name = region_name
        
        # Initialize Bedrock client
        try:
            self.bedrock_client = boto3.client(
                service_name="bedrock-runtime",
                region_name=region_name
            )
            logger.info(f"Initialized Bedrock client with model: {self.model_id}")
        except Exception as e:
            logger.error(f"Failed to initialize Bedrock client: {e}")
            raise
        
        # Load system prompt
        self.system_prompt = self._load_system_prompt()
        
        # Load few-shot examples
        self.few_shots = self._load_few_shots()
    
    def _load_system_prompt(self) -> str:
        """Load system prompt from file."""
        try:
            prompt_path = os.path.join(
                os.path.dirname(__file__),
                "prompts",
                "travel_system_prompt.txt"
            )
            with open(prompt_path, "r") as f:
                prompt = f.read()
            logger.info("Loaded travel system prompt")
            return prompt
        except Exception as e:
            logger.error(f"Error loading system prompt: {e}")
            # Fallback to minimal prompt
            return "You are a helpful travel assistant for flights and hotels. Extract intent and slots from user messages."
    
    def _get_system_prompt_with_date(self) -> str:
        """Get system prompt with current date injected."""
        from datetime import datetime
        current_date = datetime.now().strftime("%Y-%m-%d")
        return self.system_prompt.replace("{current_date}", current_date)
    
    def _load_few_shots(self) -> List[Dict]:
        """Load few-shot examples from file."""
        try:
            few_shots_path = os.path.join(
                os.path.dirname(__file__),
                "prompts",
                "few_shots.json"
            )
            with open(few_shots_path, "r") as f:
                few_shots = json.load(f)
            logger.info(f"Loaded {len(few_shots)} few-shot examples")
            return few_shots
        except Exception as e:
            logger.error(f"Error loading few-shot examples: {e}")
            return []
    
    def extract_intent_and_slots(
        self,
        user_message: str,
        session: ConversationSession
    ) -> Dict[str, Any]:
        """
        Extract intent and slots from user message using Claude.
        
        Args:
            user_message: Latest user input
            session: Conversation session with history
        
        Returns:
            Dictionary with intent, slots, and optional user_reply
        """
        logger.info(f"Extracting intent from: {user_message}")
        
        try:
            # Build conversation messages
            messages = self._build_messages(user_message, session)
            logger.debug(f"Built {len(messages)} messages for LLM")
            
            # Call Bedrock
            response = self._call_bedrock(messages)
            logger.debug(f"Received response from Bedrock: {response[:200]}...")
            
            # Parse JSON response
            result = self._parse_response(response)
            logger.info(f"Parsed intent: {result.get('intent')}")
            
            # Update session with extracted intent
            if result.get("intent"):
                session.last_intent = result["intent"]
            
            return result
            
        except Exception as e:
            logger.error(f"Error extracting intent: {e}", exc_info=True)
            logger.error(f"Error type: {type(e).__name__}")
            # Return fallback response
            return {
                "intent": "Unknown",
                "slots": {},
                "user_reply": "I apologize, but I'm having trouble understanding. Could you please rephrase your request?"
            }
    
    def _build_messages(
        self,
        user_message: str,
        session: ConversationSession
    ) -> List[Dict[str, str]]:
        """
        Build message list for Claude including history and few-shots.
        Ensures roles alternate between user and assistant.
        
        Args:
            user_message: Latest user input
            session: Conversation session
        
        Returns:
            List of message dictionaries
        """
        messages = []
        
        # Add few-shot examples (first time only)
        if len(session.messages) == 0 and self.few_shots:
            for example in self.few_shots[:3]:  # Limit to 3 examples
                messages.append({
                    "role": "user",
                    "content": example["user"]
                })
                messages.append({
                    "role": "assistant",
                    "content": json.dumps(example["assistant"])
                })
        
        # Add conversation history (last 5 exchanges)
        history = session.get_conversation_history(max_messages=10)
        for msg in history:
            # Skip if this would create consecutive same roles
            if messages and messages[-1]["role"] == msg["role"]:
                logger.debug(f"Skipping duplicate {msg['role']} message to maintain alternation")
                continue
            
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        # Add current user message only if it's not already in history
        # Check if the last message is already this user message
        if not (messages and messages[-1]["role"] == "user" and messages[-1]["content"] == user_message):
            # Also ensure we don't add user after user
            if messages and messages[-1]["role"] == "user":
                # Insert a dummy assistant acknowledgment to maintain alternation
                messages.append({
                    "role": "assistant",
                    "content": json.dumps({
                        "intent": "Acknowledged",
                        "slots": {},
                        "user_reply": None
                    })
                })
            
            messages.append({
                "role": "user",
                "content": user_message
            })
        
        # Add context about current slots if available
        if any(v is not None for v in session.slots.values()):
            context_msg = f"\n\nCurrent session slots: {json.dumps(session.slots)}"
            # Find the last user message and add context to it
            for i in range(len(messages) - 1, -1, -1):
                if messages[i]["role"] == "user":
                    messages[i]["content"] += context_msg
                    break
        
        # Final validation: ensure alternation
        for i in range(1, len(messages)):
            if messages[i]["role"] == messages[i-1]["role"]:
                logger.warning(f"Role alternation issue at position {i}: {messages[i-1]['role']} -> {messages[i]['role']}")
        
        return messages
    
    def _call_bedrock(self, messages: List[Dict[str, str]]) -> str:
        """
        Call Claude via Bedrock API.
        
        Args:
            messages: List of conversation messages
        
        Returns:
            Raw response text from Claude
        """
        # Prepare request body for Claude 3
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "temperature": 0.3,
            "system": self._get_system_prompt_with_date(),  # Inject current date
            "messages": messages
        }
        
        try:
            # Invoke model
            response = self.bedrock_client.invoke_model(
                modelId=self.model_id,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(request_body)
            )
            
            # Parse response
            response_body = json.loads(response["body"].read())
            
            # Extract text from Claude response
            if "content" in response_body and len(response_body["content"]) > 0:
                text = response_body["content"][0].get("text", "")
                logger.debug(f"Bedrock response: {text[:200]}...")
                return text
            else:
                logger.warning("Empty response from Bedrock")
                return "{}"
                
        except ClientError as e:
            logger.error(f"Bedrock API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling Bedrock: {e}")
            raise
    
    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """
        Parse JSON response from Claude.
        
        Args:
            response_text: Raw text response from Claude
        
        Returns:
            Parsed dictionary with intent, slots, user_reply
        """
        try:
            # Try to extract JSON from response
            # Claude might wrap it in markdown code blocks
            text = response_text.strip()
            
            # Remove markdown code blocks if present
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            
            text = text.strip()
            
            # Parse JSON
            result = json.loads(text)
            
            # Validate structure
            if "intent" not in result:
                logger.warning("Response missing 'intent' field")
                result["intent"] = "Unknown"
            
            if "slots" not in result:
                logger.warning("Response missing 'slots' field")
                result["slots"] = {}
            
            if "user_reply" not in result:
                result["user_reply"] = None
            
            logger.info(f"Parsed intent: {result['intent']}")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.error(f"Raw response: {response_text}")
            
            # Return fallback
            return {
                "intent": "Unknown",
                "slots": {},
                "user_reply": "I'm having trouble processing your request. Could you please try again?"
            }
        except Exception as e:
            logger.error(f"Unexpected error parsing response: {e}")
            return {
                "intent": "Unknown",
                "slots": {},
                "user_reply": "An error occurred. Please try again."
            }

