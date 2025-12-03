import React, { useState, useCallback, useEffect } from 'react';
import { VoiceController } from './components/VoiceController';
import { VoiceControllerMCP } from './components/VoiceControllerMCP';
import { VisualDisplay } from './components/VisualDisplay';
import { Header } from './components/Header';
import { ChatBot } from './components/ChatBot';
import { Itinerary, Transcript, FlightOffer, Hotel, HotelBooking } from './types';

type AIMode = 'gemini' | 'mcp';

const App: React.FC = () => {
  const [aiMode, setAiMode] = useState<AIMode>('gemini');
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [visualData, setVisualData] = useState<Itinerary | FlightOffer[] | Hotel[] | HotelBooking[] | null>(null);
  const [viewMode, setViewMode] = useState<'itinerary' | 'flights' | 'hotels' | 'hotel-booking' | 'flight-booking' | 'loading' | 'search'>('search');
  const [isThinking, setIsThinking] = useState(false);

  const handleStartConversation = () => {
    setTranscripts([{ speaker: 'ai', text: "Hello! Where would you like to go today?", isFinal: true }]);
    setIsConversationActive(true);
  };

  const handleStopConversation = () => {
    setIsConversationActive(false);
  };

  const toggleAIMode = () => {
    if (isConversationActive) {
      // Stop current session before switching
      setIsConversationActive(false);
    }
    setAiMode(prev => prev === 'gemini' ? 'mcp' : 'gemini');
    setTranscripts([]);
    setVisualData(null);
    setViewMode('search');
  };
  
  const handleTranscriptUpdate = useCallback((speaker: 'user' | 'ai', textChunk: string, isFinal: boolean) => {
    setTranscripts(prev => {
        const newTranscripts = [...prev];
        const lastTranscript = newTranscripts.length > 0 ? newTranscripts[newTranscripts.length - 1] : null;

        // Check if this is a duplicate of the last transcript
        if (lastTranscript && 
            lastTranscript.speaker === speaker && 
            lastTranscript.text === textChunk && 
            lastTranscript.isFinal === isFinal) {
            // Exact duplicate - ignore it
            console.log(`⚠️ Ignoring duplicate ${speaker} transcript:`, textChunk.substring(0, 50));
            return prev;
        }

        // Update existing transcript if it's from the same speaker and not final yet
        if (lastTranscript && lastTranscript.speaker === speaker && lastTranscript.isFinal !== true) {
            // Update the text (accumulated from geminiService)
            lastTranscript.text = textChunk;
            lastTranscript.isFinal = isFinal;
        } else {
            // Create new transcript entry
            newTranscripts.push({
                speaker: speaker,
                text: textChunk,
                isFinal: isFinal,
            });
        }
        return newTranscripts;
    });
  }, []);


  const clearVisuals = useCallback(() => {
    setVisualData(null);
    setViewMode('search');
  }, []);

  useEffect(() => {
    if (isConversationActive) {
      clearVisuals();
    }
  }, [isConversationActive, clearVisuals]);

  return (
    <div className="flex flex-col h-screen font-sans bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header />
      
      {/* AI Mode Toggle */}
      <div className="px-4 py-2 flex items-center justify-center gap-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">AI Mode:</span>
        <button
          onClick={toggleAIMode}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            aiMode === 'gemini'
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
          }`}
        >
          🌟 Gemini (Function Calling)
        </button>
        <button
          onClick={toggleAIMode}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            aiMode === 'mcp'
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
          }`}
        >
          🤖 MCP + Claude (Bedrock)
        </button>
      </div>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-hidden">
        <div className="flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden h-full">
          {aiMode === 'gemini' ? (
            <VoiceController
              isActive={isConversationActive}
              onStart={handleStartConversation}
              onStop={handleStopConversation}
              transcripts={transcripts}
              handleTranscriptUpdate={handleTranscriptUpdate}
              setVisualData={setVisualData}
              setViewMode={setViewMode}
              isThinking={isThinking}
              setIsThinking={setIsThinking}
            />
          ) : (
            <VoiceControllerMCP
              handleTranscriptUpdate={handleTranscriptUpdate}
              setVisualData={setVisualData}
              setViewMode={setViewMode}
              setIsThinking={setIsThinking}
              isVoiceActive={isConversationActive}
              setIsVoiceActive={setIsConversationActive}
              transcripts={transcripts}
              isThinking={isThinking}
            />
          )}
        </div>
        <div className="flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden h-full">
          <VisualDisplay data={visualData} viewMode={viewMode} />
        </div>
      </main>
      <ChatBot />
    </div>
  );
};

export default App;