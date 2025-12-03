import {
    GoogleGenAI,
    FunctionDeclaration,
    Type,
    Modality,
    LiveServerMessage,
    Chat,
} from '@google/genai';
import {
    Itinerary,
    FlightOffer,
    LiveSession,
    Hotel,
    HotelBooking,
} from '../types';
import { decode, decodeAudioData, createBlob } from '../utils/audioUtils';
import ttsService from './ttsService';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY! });

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') ?? '';
const FLIGHT_SEARCH_ENDPOINT = BACKEND_BASE_URL
    ? `${BACKEND_BASE_URL}/api/flights/search`
    : '/api/flights/search';
const HOTEL_SEARCH_ENDPOINT = BACKEND_BASE_URL
    ? `${BACKEND_BASE_URL}/api/hotels/search`
    : '/api/hotels/search';
const HOTEL_BOOKING_ENDPOINT = BACKEND_BASE_URL
    ? `${BACKEND_BASE_URL}/api/hotels/book`
    : '/api/hotels/book';

interface FlightSearchParams {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    maxPrice?: number;
    currencyCode?: string;
    travelClass?: string;
    nonStop?: boolean;
    tripType?: 'one-way' | 'round-trip';
}

async function searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
    // Always set currency to USD if not specified
    const searchParams = {
        ...params,
        currencyCode: params.currencyCode || 'USD'
    };
    
    const response = await fetch(FLIGHT_SEARCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
        console.error('Backend flight search error:', await response.text());
        throw new Error('Failed to fetch flight offers from the backend.');
    }

    return response.json();
}

interface HotelSearchParams {
    location: string;
    checkInDate?: string;
    checkOutDate?: string;
    numGuests?: number;
}

async function searchHotels(params: HotelSearchParams): Promise<Hotel[]> {
    const response = await fetch(HOTEL_SEARCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        console.error('Backend hotel search error:', await response.text());
        throw new Error('Failed to fetch hotels from the backend.');
    }

    const result = await response.json();
    return result.hotels || [];
}

interface HotelBookingParams {
    hotelName: string;
    location: string;
    checkInDate: string;
    checkOutDate: string;
    numGuests: number;
    roomType: string;
}

async function bookHotel(params: HotelBookingParams): Promise<HotelBooking> {
    const response = await fetch(HOTEL_BOOKING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        console.error('Backend hotel booking error:', await response.text());
        throw new Error('Failed to book hotel.');
    }

    const result = await response.json();
    return result.booking;
}


const showItinerary: FunctionDeclaration = {
    name: 'show_itinerary',
    parameters: {
      type: Type.OBJECT,
      description: 'Displays a generated travel itinerary to the user.',
      properties: {
        destination: { type: Type.STRING },
        duration: { type: Type.NUMBER },
        days: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    day: { type: Type.NUMBER },
                    title: { type: Type.STRING },
                    activities: { type: Type.ARRAY, items: { type: Type.STRING } },
                    lodging: { type: Type.STRING }
                },
                required: ['day', 'title', 'activities']
            }
        }
      },
      required: ['destination', 'duration', 'days'],
    },
};

const findAndShowFlights: FunctionDeclaration = {
    name: 'find_and_show_flights',
    parameters: {
        type: Type.OBJECT,
        description: 'Searches for and displays flight options to the user. Always use USD currency.',
        properties: {
            origin: { type: Type.STRING, description: 'The departure city.' },
            destination: { type: Type.STRING, description: 'The arrival city.' },
            departureDate: { type: Type.STRING, description: 'The departure date in YYYY-MM-DD format.' },
            returnDate: { type: Type.STRING, description: 'The return date in YYYY-MM-DD format for round trips.' },
            maxPrice: { type: Type.NUMBER, description: 'Maximum acceptable total price in USD.' },
            currencyCode: { type: Type.STRING, description: 'Currency code, always set to USD.' },
            travelClass: { type: Type.STRING, description: 'Preferred cabin class such as ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST.' },
            nonStop: { type: Type.BOOLEAN, description: 'Whether only non-stop flights should be shown.' },
            tripType: { type: Type.STRING, description: 'one-way or round-trip (default to one-way if omitted).' },
        },
        required: ['origin', 'destination', 'departureDate'],
    },
};

const searchAndShowHotels: FunctionDeclaration = {
    name: 'search_and_show_hotels',
    parameters: {
        type: Type.OBJECT,
        description: 'Searches for and displays Marriott hotel options in a location.',
        properties: {
            location: { type: Type.STRING, description: 'The city or location to search for hotels.' },
            checkInDate: { type: Type.STRING, description: 'The check-in date in YYYY-MM-DD format.' },
            checkOutDate: { type: Type.STRING, description: 'The check-out date in YYYY-MM-DD format.' },
            numGuests: { type: Type.NUMBER, description: 'Number of guests.' },
        },
        required: ['location'],
    },
};

const bookHotelRoom: FunctionDeclaration = {
    name: 'book_hotel_room',
    parameters: {
        type: Type.OBJECT,
        description: 'Books a hotel room for the user.',
        properties: {
            hotelName: { type: Type.STRING, description: 'The name of the hotel to book.' },
            location: { type: Type.STRING, description: 'The location/city of the hotel.' },
            checkInDate: { type: Type.STRING, description: 'The check-in date in YYYY-MM-DD format.' },
            checkOutDate: { type: Type.STRING, description: 'The check-out date in YYYY-MM-DD format.' },
            numGuests: { type: Type.NUMBER, description: 'Number of guests.' },
            roomType: { type: Type.STRING, description: 'Type of room (e.g., Standard, Suite, Deluxe).' },
        },
        required: ['hotelName', 'location', 'checkInDate', 'checkOutDate'],
    },
};
  
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

interface StartLiveSessionParams {
  handleTranscriptUpdate: (speaker: 'user' | 'ai', textChunk: string, isFinal: boolean) => void;
  setVisualData: (data: Itinerary | FlightOffer[] | Hotel[] | HotelBooking[] | null) => void;
  setViewMode: (mode: 'itinerary' | 'flights' | 'hotels' | 'hotel-booking' | 'loading' | 'search') => void;
  setIsThinking: (isThinking: boolean) => void;
  onSessionEnd: () => void;
}

export const startLiveSession = async (params: StartLiveSessionParams): Promise<LiveSession> => {
    const { handleTranscriptUpdate, setVisualData, setViewMode, setIsThinking, onSessionEnd } = params;

    initializeAudioPlayback();
    
    let inputAudioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let scriptProcessor: ScriptProcessorNode | null = null;
    
    let currentInputTranscription = '';
    let currentOutputTranscription = '';

    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: async () => {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    const source = inputAudioContext.createMediaStreamSource(stream);
                    scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                } catch (err) {
                    console.error("Error setting up microphone stream:", err);
                    onSessionEnd();
                }
            },
            onmessage: async (message: LiveServerMessage) => {
                if (message.serverContent?.inputTranscription) {
                    const { text } = message.serverContent.inputTranscription;
                    currentInputTranscription += text;
                    handleTranscriptUpdate('user', currentInputTranscription, false);
                }

                if (currentInputTranscription && (message.serverContent?.outputTranscription || message.serverContent?.modelTurn || message.toolCall)) {
                    handleTranscriptUpdate('user', currentInputTranscription, true); 
                    currentInputTranscription = '';
                }

                if (message.serverContent?.outputTranscription) {
                    const { text } = message.serverContent.outputTranscription;
                    currentOutputTranscription += text;
                    handleTranscriptUpdate('ai', currentOutputTranscription, false);
                }
                
                const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                if (base64EncodedAudioString) {
                    nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                    const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputAudioContext, 24000, 1);
                    const source = outputAudioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputNode);
                    source.addEventListener('ended', () => { 
                        sources.delete(source);
                    });
                    source.start(nextStartTime);
                    nextStartTime += audioBuffer.duration;
                    sources.add(source);
                }

                if (message.serverContent?.interrupted) {
                    stopAudioPlayback();
                }

                if (message.toolCall) {
                    setIsThinking(true);
                    setViewMode('loading');
                    const functionCalls = message.toolCall.functionCalls;
                    const functionResponses: any[] = [];
                    let toolError = false;

                    for (const fc of functionCalls) {
                        console.log('🔧 TOOL CALLED:', fc.name);
                        console.log('📋 TOOL ARGUMENTS:', JSON.stringify(fc.args, null, 2));
                        
                        let responseMsg = "ok, I'm displaying that for you now.";
                        try {
                            if (fc.name === 'show_itinerary') {
                                console.log('✅ Executing: show_itinerary');
                                setVisualData(fc.args as unknown as Itinerary);
                                setViewMode('itinerary');
                            } else if (fc.name === 'find_and_show_flights') {
                                console.log('✅ Executing: find_and_show_flights');
                                console.log('   Origin:', fc.args.origin);
                                console.log('   Destination:', fc.args.destination);
                                console.log('   Date:', fc.args.departureDate);
                                const flights = await searchFlights(fc.args as FlightSearchParams);
                                console.log('✅ Found', flights.length, 'flights');
                                setVisualData(flights);
                                setViewMode('flights');
                                responseMsg = `I found some flights from ${fc.args.origin} to ${fc.args.destination}. Here they are.`
                            } else if (fc.name === 'search_and_show_hotels') {
                                console.log('✅ Executing: search_and_show_hotels');
                                console.log('   Location:', fc.args.location);
                                const hotels = await searchHotels(fc.args as HotelSearchParams);
                                console.log('✅ Found', hotels.length, 'hotels');
                                setVisualData(hotels);
                                setViewMode('hotels');
                                responseMsg = `I found ${hotels.length} Marriott hotels in ${fc.args.location}. Here they are.`
                            } else if (fc.name === 'book_hotel_room') {
                                console.log('✅ Executing: book_hotel_room');
                                console.log('   Hotel:', fc.args.hotelName);
                                console.log('   Location:', fc.args.location);
                                const booking = await bookHotel(fc.args as HotelBookingParams);
                                console.log('✅ Booking confirmed:', booking.confirmation_number);
                                setVisualData([booking]);
                                setViewMode('hotel-booking');
                                responseMsg = `Your hotel booking is confirmed! Confirmation number: ${booking.confirmation_number}`;
                            }
                        } catch(e) {
                            console.error('❌ ERROR executing tool', fc.name, ':', e);
                            responseMsg = "Sorry, I ran into an error trying to find that information.";
                            toolError = true;
                        }
                        
                        functionResponses.push({
                            id: fc.id,
                            name: fc.name,
                            response: { result: responseMsg }
                        });
                    }

                    if (toolError) {
                        setViewMode('search'); // Revert to initial view on error
                    }

                    sessionPromise.then(session => {
                        session.sendToolResponse({ functionResponses });
                    });
                    setIsThinking(false);
                }
                if (message.serverContent?.turnComplete) {
                    if (currentOutputTranscription) {
                        handleTranscriptUpdate('ai', currentOutputTranscription, true);
                        currentOutputTranscription = '';
                    }
                    if (currentInputTranscription) {
                        handleTranscriptUpdate('user', currentInputTranscription, true);
                        currentInputTranscription = '';
                    }
                }
            },
            onerror: (e: ErrorEvent) => {
                console.error('Session error:', e);
                onSessionEnd();
            },
            onclose: (e: CloseEvent) => {
                 if (currentInputTranscription) {
                    handleTranscriptUpdate('user', currentInputTranscription, true);
                    currentInputTranscription = '';
                }
                onSessionEnd();
            },
        },
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},  // Enable transcription
            outputAudioTranscription: {},
            tools: [{ functionDeclarations: [showItinerary, findAndShowFlights, searchAndShowHotels, bookHotelRoom] }],
            systemInstruction: `CRITICAL LANGUAGE REQUIREMENT: You MUST use ONLY English language (Latin alphabet A-Z). 
NEVER use Kannada (ಕನ್ನಡ), Hindi (हिन्दी), Telugu, Tamil, or any other non-English scripts.
ALL transcription and responses must be in English with Latin alphabet ONLY.
Even if you detect another language being spoken, transcribe/translate it to English.

You are a friendly and helpful AI travel assistant. Keep the conversation going until the traveler explicitly says they are done. Gather key preferences by asking follow-up questions about departure/arrival times, budget, cabin class, one-way vs. round trip, hotel preferences, check-in/check-out dates, and any other constraints before finalizing results. You can create itineraries, search for flights, search for Marriott hotels, and book hotel rooms. When a user asks for flights, ALWAYS use the 'find_and_show_flights' tool with currencyCode set to 'USD'. For itineraries, use 'show_itinerary'. For hotel searches, use 'search_and_show_hotels'. For hotel bookings, use 'book_hotel_room'. Always be proactive and assist with travel-related queries. Keep your responses concise and avoid repeating words.`
        }
    });
    
    const session = await sessionPromise;
    
    const originalClose = session.close.bind(session);
    const cleanup = () => {
        if (scriptProcessor) {
            scriptProcessor.disconnect();
            scriptProcessor = null;
        }
        if (inputAudioContext && inputAudioContext.state !== 'closed') {
            inputAudioContext.close();
            inputAudioContext = null;
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        stopAudioPlayback();
    };

    session.close = () => {
        cleanup();
        originalClose();
    };

    return session;
};

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

let chat: Chat | null = null;

export const sendChatMessage = async (message: string, history: ChatMessage[]): Promise<string> => {
    if (!chat) {
        chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: history.slice(1).map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            })),
            config: {
                systemInstruction: "You are a helpful travel assistant chatbot. Stay engaged until the user confirms they are finished. Ask clarifying follow-up questions (departure or arrival times, budgets, one-way vs. round-trip, cabin preferences, etc.) before finalizing recommendations, and keep answers concise but proactive."
            }
        });
    }

    try {
        const response = await chat.sendMessage({ message });
        return response.text;
    } catch(e) {
        console.error("Chat API error:", e);
        chat = null;
        return "Sorry, something went wrong. Please try again.";
    }
};
