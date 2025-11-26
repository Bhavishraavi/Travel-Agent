import React, { useState, useCallback, useEffect } from 'react';
import { VoiceController } from './components/VoiceController';
import { VisualDisplay } from './components/VisualDisplay';
import { Header } from './components/Header';
import { ChatBot } from './components/ChatBot';
import { Itinerary, Transcript, FlightOffer } from './types';

const App: React.FC = () => {
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [visualData, setVisualData] = useState<Itinerary | FlightOffer[] | null>(null);
  const [viewMode, setViewMode] = useState<'itinerary' | 'flights' | 'loading' | 'search'>('search');
  const [isThinking, setIsThinking] = useState(false);

  const handleStartConversation = () => {
    setTranscripts([{ speaker: 'ai', text: "Hello! Where would you like to go today?", isFinal: true }]);
    setIsConversationActive(true);
  };

  const handleStopConversation = () => {
    setIsConversationActive(false);
  };
  
  const handleTranscriptUpdate = useCallback((speaker: 'user' | 'ai', textChunk: string, isFinal: boolean) => {
    setTranscripts(prev => {
        const newTranscripts = [...prev];
        const lastTranscript = newTranscripts.length > 0 ? newTranscripts[newTranscripts.length - 1] : null;

        if (lastTranscript && lastTranscript.speaker === speaker && lastTranscript.isFinal !== true) {
            lastTranscript.text += textChunk;
            lastTranscript.isFinal = isFinal;
        } else {
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
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-hidden">
        <div className="flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden h-full">
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