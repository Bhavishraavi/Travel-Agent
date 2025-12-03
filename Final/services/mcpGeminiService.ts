/**
 * Hybrid Service: Gemini for Voice-to-Text + MCP Backend for AI Processing
 * 
 * Flow:
 * 1. Gemini Live API captures voice and transcribes to text
 * 2. Send text to MCP backend (/api/chat)
 * 3. Backend (Claude/Bedrock) processes with MCP router
 * 4. Return results to frontend
 */

import {
    GoogleGenAI,
    Modality,
    LiveServerMessage,
} from '@google/genai';
import {
    LiveSession,
    Hotel,
    HotelBooking,
    FlightOffer,
} from '../types';
import { decode, decodeAudioData, createBlob } from '../utils/audioUtils';
import ttsService from './ttsService';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY! });

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') ?? 'http://localhost:8000';
const MCP_CHAT_ENDPOINT = `${BACKEND_BASE_URL}/api/chat`;
const FLIGHT_SEARCH_ENDPOINT = `${BACKEND_BASE_URL}/api/flights/search`;
const HOTEL_SEARCH_ENDPOINT = `${BACKEND_BASE_URL}/api/hotels/search`;
const HOTEL_BOOKING_ENDPOINT = `${BACKEND_BASE_URL}/api/hotels/book`;

// Generate unique session ID
const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

let sessionId = generateSessionId();

// Audio playback setup
let outputAudioContext: AudioContext;
let outputNode: GainNode;
let nextStartTime = 0;
const sources = new Set<AudioBufferSourceNode>();

function initializeAudioPlayback() {
    if (!outputAudioContext || outputAudioContext.state === 'closed') {
        outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        outputNode = outputAudioContext.createGain();
        outputNode.connect(outputAudioContext.destination);
        nextStartTime = 0;
        sources.clear();
    }
}

function stopAudioPlayback() {
    for (const source of sources.values()) {
        source.stop();
        sources.delete(source);
    }
    nextStartTime = 0;
}

interface StartHybridSessionParams {
  handleTranscriptUpdate: (speaker: 'user' | 'ai', textChunk: string, isFinal: boolean) => void;
  setVisualData: (data: any) => void;
  setViewMode: (mode: 'itinerary' | 'flights' | 'hotels' | 'hotel-booking' | 'flight-booking' | 'loading' | 'search') => void;
  setIsThinking: (isThinking: boolean) => void;
  onSessionEnd: () => void;
}

/**
 * Send transcribed text to MCP backend and handle response
 */
async function sendToMCPBackend(
    userText: string,
    params: StartHybridSessionParams
): Promise<void> {
    const { handleTranscriptUpdate, setVisualData, setViewMode, setIsThinking } = params;
    
    try {
        console.log('🔄 Sending to MCP Backend:', userText);
        setIsThinking(true);
        
        const response = await fetch(MCP_CHAT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                user_text: userText
            })
        });

        if (!response.ok) {
            throw new Error('MCP backend request failed');
        }

        const result = await response.json();
        console.log('✅ MCP Response:', result);
        
        const { reply, intent, slots, flights, hotels, booking } = result;
        
        // Display AI's reply ONLY if not executing a tool with results
        // We'll update the reply after tool execution with better context
        const willExecuteTool = (
            (intent === 'FlightSearch' && slots.origin && slots.destination && slots.departure_date) ||
            (intent === 'FlightBooking' && slots.airline && slots.flight_number) ||
            (intent === 'HotelSearch' && slots.location) ||
            (intent === 'HotelBooking' && slots.hotel_name && slots.location && slots.check_in_date && slots.check_out_date)
        );
        
        if (!willExecuteTool && reply) {
            // Only show reply if we're NOT executing a tool
            // (for greetings, questions, clarifications, etc.)
            handleTranscriptUpdate('ai', reply, true);
        }
        
        // MCP backend already executed the tools - just display the results!
        setIsThinking(false);
        
        // Handle flight search results
        if (flights && flights.length > 0) {
            console.log('✈️ Displaying flights from MCP:', flights.length, 'flights');
            setVisualData(flights);
            setViewMode('flights');
            handleTranscriptUpdate('ai', reply, true);
            ttsService.speak(reply); // 🔊 Speak the response
        } 
        // Handle hotel search results
        else if (hotels && hotels.length > 0) {
            console.log('🏨 Displaying hotels from MCP:', hotels.length, 'hotels');
            setVisualData(hotels);
            setViewMode('hotels');
            handleTranscriptUpdate('ai', reply, true);
            ttsService.speak(reply); // 🔊 Speak the response
        }
        // Handle booking confirmation (both flight and hotel)
        else if (booking) {
            console.log('📋 Displaying booking confirmation from MCP:', booking.confirmation_number);
            setVisualData([booking]);
            // Check if it's a flight or hotel booking
            if ('airline' in booking) {
                setViewMode('flight-booking');
            } else {
                setViewMode('hotel-booking');
            }
            handleTranscriptUpdate('ai', reply, true);
            ttsService.speak(reply); // 🔊 Speak the response
        }
        // No tool results - just show the reply (greeting, questions, etc.)
        else {
            handleTranscriptUpdate('ai', reply, true);
            ttsService.speak(reply); // 🔊 Speak the response
        }
        
        setIsThinking(false);
        
    } catch (error) {
        console.error('❌ MCP Backend Error:', error);
        const errorMsg = "Sorry, I encountered an error. Please try again.";
        handleTranscriptUpdate('ai', errorMsg, true);
        ttsService.speak(errorMsg); // 🔊 Speak error message
        setIsThinking(false);
    }
}

/**
 * Start hybrid session: Gemini for voice transcription + MCP for AI processing
 */
export const startHybridMCPSession = async (params: StartHybridSessionParams): Promise<LiveSession> => {
    const { handleTranscriptUpdate, onSessionEnd } = params;

    console.log('🚀 Starting MCP Hybrid Session...');
    console.log('🔑 API Key present:', !!import.meta.env.VITE_API_KEY);

    initializeAudioPlayback();
    
    let inputAudioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let scriptProcessor: ScriptProcessorNode | null = null;
    
    let currentInputTranscription = '';
    let lastSentTranscription = '';
    let isSending = false; // Prevent duplicate sends
    let hasAddedFinalTranscript = false; // Track if we've marked transcript as final
    let isSessionActive = false; // Track session state
    let isTTSSpeaking = false; // Track if TTS is currently speaking (to pause microphone)

    // Setup TTS callbacks to pause/resume microphone
    ttsService.setOnSpeakStart(() => {
        console.log('🔇 TTS Started: Pausing microphone input to prevent feedback');
        isTTSSpeaking = true;
    });

    ttsService.setOnSpeakEnd(() => {
        console.log('🎤 TTS Finished: Resuming microphone input');
        isTTSSpeaking = false;
    });

    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: async () => {
                console.log('✅ MCP Voice Session: WebSocket opened');
                try {
                    isSessionActive = true; // Session is now active
                    console.log('🎤 Requesting microphone access...');
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    console.log('✅ Microphone access granted');
                    
                    inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    const source = inputAudioContext.createMediaStreamSource(stream);
                    scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        // Only send audio if session is active AND TTS is not speaking
                        if (!isSessionActive || isTTSSpeaking) return;
                        
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then((session) => {
                            // Double-check session is still active and TTS not speaking
                            if (isSessionActive && !isTTSSpeaking) {
                                try {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                } catch (err) {
                                    // Silently ignore if session is closed
                                    if (isSessionActive) {
                                        console.error("❌ Error sending audio:", err);
                                    }
                                }
                            }
                        }).catch(err => {
                            // Session promise rejected, ignore
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                    console.log('✅ Audio processing setup complete');
                } catch (err) {
                    console.error("❌ Error setting up microphone stream:", err);
                    isSessionActive = false;
                    onSessionEnd();
                }
            },
            onmessage: async (message: LiveServerMessage) => {
                // Get transcription from Gemini (voice-to-text only)
                if (message.serverContent?.inputTranscription && !hasAddedFinalTranscript) {
                    const { text } = message.serverContent.inputTranscription;
                    currentInputTranscription += text;
                    handleTranscriptUpdate('user', currentInputTranscription, false);
                }

                // When Gemini starts responding (modelTurn), it means user finished speaking
                // Send the transcription to MCP backend instead of using Gemini's response
                if (!isSending && 
                    !hasAddedFinalTranscript &&
                    currentInputTranscription && 
                    currentInputTranscription.trim().length > 0 &&
                    currentInputTranscription !== lastSentTranscription &&
                    message.serverContent?.modelTurn) {
                    
                    isSending = true; // Prevent duplicate sends
                    hasAddedFinalTranscript = true; // Mark as final
                    
                    console.log('🎤 User finished speaking:', currentInputTranscription);
                    handleTranscriptUpdate('user', currentInputTranscription, true);
                    
                    // Send to MCP backend for processing (not Gemini's response)
                    await sendToMCPBackend(currentInputTranscription, params);
                    
                    lastSentTranscription = currentInputTranscription;
                    currentInputTranscription = '';
                    
                    // Reset flags for next input
                    setTimeout(() => {
                        isSending = false;
                        hasAddedFinalTranscript = false;
                    }, 1000); // Wait 1 second before accepting new input
                }
                
                // Ignore Gemini's audio output - we're using MCP for responses
                // No audio playback needed in MCP mode
            },
            onerror: (e: ErrorEvent) => {
                console.error('❌ MCP Voice Session ERROR:', e);
                console.error('❌ Error details:', {
                    message: e.message,
                    error: e.error,
                    type: e.type
                });
                isSessionActive = false;
                onSessionEnd();
            },
            onclose: (e: CloseEvent) => {
                console.log('🔴 MCP Voice Session CLOSED:', {
                    code: e.code,
                    reason: e.reason,
                    wasClean: e.wasClean
                });
                isSessionActive = false;
                if (currentInputTranscription) {
                    handleTranscriptUpdate('user', currentInputTranscription, true);
                }
                onSessionEnd();
            },
        },
        config: {
            // Use Gemini ONLY for transcription - no responses needed!
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},  // Enable transcription (language auto-detected)
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: "Puck"
                    }
                }
            },
            // NO tools - we handle logic in MCP backend!
            systemInstruction: `ULTRA-CRITICAL ENGLISH-ONLY INSTRUCTION:
You are a TRANSCRIPTION MACHINE. Your ONLY job is to convert speech to English text.

ABSOLUTE RULES:
1. TRANSCRIBE EVERYTHING using English letters (A-Z) ONLY
2. If you hear "San Jose" → write "San Jose" (NOT सॅन जोस or ಸ್ಯಾನ್ ಜೋಸ್)
3. If you hear "New York" → write "New York" (NOT न्यूयॉर्क or ನ್ಯೂಯಾರ್ಕ್)
4. If you hear any non-English language → transcribe phonetically in English letters
5. NEVER use: Kannada, Hindi, Telugu, Tamil, Marathi, or ANY non-Latin scripts
6. NEVER output: ಹಾಯ್, नमस्ते, సుప్రభాతం or similar characters
7. ALWAYS output: English alphabet (A-Z, a-z) ONLY

EXAMPLES OF CORRECT TRANSCRIPTION:
✓ User speaks: "San Jose" → You write: "San Jose"
✓ User speaks: "Book a flight" → You write: "Book a flight"  
✓ User speaks: "Mumbai" → You write: "Mumbai"
✓ User speaks: Hindi word → You write phonetic English like "namaste"

You do NOT provide assistance. You do NOT answer questions. You ONLY transcribe to English.
MCP backend handles all AI processing.`
        }
    });
    
    console.log('⏳ Waiting for session connection...');
    const session = await sessionPromise;
    console.log('✅ Session connected successfully');
    
    if (!session) {
        console.error('❌ Session is null or undefined!');
        throw new Error('Failed to create session');
    }
    
    const originalClose = session.close.bind(session);
    const cleanup = () => {
        // Mark session as inactive FIRST to stop audio processing
        isSessionActive = false;
        
        // Stop audio processing
        if (scriptProcessor) {
            try {
                scriptProcessor.disconnect();
            } catch (e) {
                // Already disconnected
            }
            scriptProcessor = null;
        }
        
        // Close audio context
        if (inputAudioContext && inputAudioContext.state !== 'closed') {
            try {
                inputAudioContext.close();
            } catch (e) {
                // Already closed
            }
            inputAudioContext = null;
        }
        
        // Stop microphone tracks
        if (stream) {
            stream.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (e) {
                    // Already stopped
                }
            });
            stream = null;
        }
        
        stopAudioPlayback();
    };

    session.close = () => {
        cleanup();
        try {
            originalClose();
        } catch (e) {
            // Session already closed, ignore
        }
    };

    console.log('✅ MCP Hybrid Session fully initialized');
    return session;
};

// Reset session (for new conversation)
export const resetMCPSession = () => {
    sessionId = generateSessionId();
    ttsService.cancel(); // Stop any ongoing speech
};

// Export TTS service for external control (mute/unmute)
export { ttsService };

