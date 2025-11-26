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
} from '../types';
import { decode, decodeAudioData, createBlob } from '../utils/audioUtils';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') ?? '';
const FLIGHT_SEARCH_ENDPOINT = BACKEND_BASE_URL
    ? `${BACKEND_BASE_URL}/api/flights/search`
    : '/api/flights/search';

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
    const response = await fetch(FLIGHT_SEARCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        console.error('Backend flight search error:', await response.text());
        throw new Error('Failed to fetch flight offers from the backend.');
    }

    return response.json();
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
        description: 'Searches for and displays flight options to the user.',
        properties: {
            origin: { type: Type.STRING, description: 'The departure city.' },
            destination: { type: Type.STRING, description: 'The arrival city.' },
            departureDate: { type: Type.STRING, description: 'The departure date in YYYY-MM-DD format.' },
            returnDate: { type: Type.STRING, description: 'The return date in YYYY-MM-DD format for round trips.' },
            maxPrice: { type: Type.NUMBER, description: 'Maximum acceptable total price in the selected currency.' },
            currencyCode: { type: Type.STRING, description: 'Currency code for price filtering, e.g., USD.' },
            travelClass: { type: Type.STRING, description: 'Preferred cabin class such as ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST.' },
            nonStop: { type: Type.BOOLEAN, description: 'Whether only non-stop flights should be shown.' },
            tripType: { type: Type.STRING, description: 'one-way or round-trip (default to one-way if omitted).' },
        },
        required: ['origin', 'destination', 'departureDate'],
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
  setVisualData: (data: Itinerary | FlightOffer[] | null) => void;
  setViewMode: (mode: 'itinerary' | 'flights' | 'loading' | 'search') => void;
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
                    handleTranscriptUpdate('user', text, false);
                }

                if (currentInputTranscription && (message.serverContent?.outputTranscription || message.serverContent?.modelTurn || message.toolCall)) {
                    handleTranscriptUpdate('user', '', true); 
                    currentInputTranscription = '';
                }

                if (message.serverContent?.outputTranscription) {
                    const { text } = message.serverContent.outputTranscription;
                    currentOutputTranscription += text;
                    handleTranscriptUpdate('ai', text, false);
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
                        let responseMsg = "ok, I'm displaying that for you now.";
                        try {
                            if (fc.name === 'show_itinerary') {
                                setVisualData(fc.args as unknown as Itinerary);
                                setViewMode('itinerary');
                            } else if (fc.name === 'find_and_show_flights') {
                                const flights = await searchFlights(fc.args as FlightSearchParams);
                                setVisualData(flights);
                                setViewMode('flights');
                                responseMsg = `I found some flights from ${fc.args.origin} to ${fc.args.destination}. Here they are.`
                            }
                        } catch(e) {
                            console.error(`Error executing tool ${fc.name}:`, e);
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
                        handleTranscriptUpdate('ai', '', true);
                        currentOutputTranscription = '';
                    }
                    if (currentInputTranscription) {
                        handleTranscriptUpdate('user', '', true);
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
                    handleTranscriptUpdate('user', '', true);
                    currentInputTranscription = '';
                }
                onSessionEnd();
            },
        },
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            tools: [{ functionDeclarations: [showItinerary, findAndShowFlights] }],
            systemInstruction: "You are a friendly and helpful AI travel assistant. Keep the conversation going until the traveler explicitly says they are done. Gather key preferences by asking follow-up questions about departure/arrival times, budget, cabin class, one-way vs. round trip, and any other constraints before finalizing results. You can create itineraries and search for flights. When a user asks for flights, use the 'find_and_show_flights' tool. For itineraries, use 'show_itinerary'. Always be proactive and assist with travel-related queries."
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
