import React, { useEffect, useRef, useCallback, useState } from 'react';
// Fix: Add LiveSession to import from local types
import { Itinerary, Transcript, LiveSession, FlightOffer } from '../types';
import { startLiveSession } from '../services/geminiService';
import { MicrophoneIcon, StopCircleIcon, SparklesIcon } from './IconComponents';

interface VoiceControllerProps {
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  transcripts: Transcript[];
  handleTranscriptUpdate: (speaker: 'user' | 'ai', textChunk: string, isFinal: boolean) => void;
  setVisualData: (data: Itinerary | FlightOffer[] | null) => void;
  setViewMode: (mode: 'itinerary' | 'flights' | 'loading' | 'search') => void;
  isThinking: boolean;
  setIsThinking: (isThinking: boolean) => void;
}

export const VoiceController: React.FC<VoiceControllerProps> = ({
  isActive,
  onStart,
  onStop,
  transcripts,
  handleTranscriptUpdate,
  setVisualData,
  setViewMode,
  isThinking,
  setIsThinking
}) => {
  const sessionRef = useRef<LiveSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const [isMicrophoneReady, setIsMicrophoneReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanupAudio = useCallback(() => {
    if (scriptProcessorRef.current && audioContextRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const handleStop = useCallback(() => {
    onStop();
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    cleanupAudio();
  }, [onStop, cleanupAudio]);

  const handleStart = useCallback(async () => {
    onStart();
    setError(null);
    try {
        // Permission check
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop this stream, service will start its own

        const session = await startLiveSession({
            handleTranscriptUpdate,
            setVisualData,
            setViewMode,
            setIsThinking,
            onSessionEnd: handleStop
        });
        sessionRef.current = session;

    } catch (err) {
      console.error("Error starting session:", err);
      setError("Could not start microphone. Please grant permission and try again.");
      onStop();
    }
  }, [onStart, handleTranscriptUpdate, setVisualData, setViewMode, setIsThinking, handleStop, onStop]);
  
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        setIsMicrophoneReady(true);
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(() => {
        setIsMicrophoneReady(false);
        setError("Microphone permission is required to use the voice features.");
      });
  }, []);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div className="flex flex-col h-full p-4">
      <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto pr-2 space-y-4">
        {transcripts.map((t, i) => (
          <div key={i} className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${t.speaker === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'}`}>
              <p className={t.isFinal === false ? 'opacity-70' : ''}>{t.text}</p>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-bl-none flex items-center space-x-2">
                <SparklesIcon className="h-5 w-5 animate-pulse" />
                <span>Searching for the best options... this might take a moment.</span>
            </div>
          </div>
        )}
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
        {error && <p className="text-red-500 text-center mb-2">{error}</p>}
        {isActive ? (
          <button onClick={handleStop} className="flex items-center justify-center w-20 h-20 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-red-300">
            <StopCircleIcon className="w-12 h-12" />
          </button>
        ) : (
          <button onClick={handleStart} disabled={!isMicrophoneReady} className="flex items-center justify-center w-20 h-20 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-blue-300">
            <MicrophoneIcon className="w-10 h-10" />
          </button>
        )}
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {isActive ? 'Listening...' : (isMicrophoneReady ? 'Tap to start planning' : 'Microphone access needed')}
        </p>
      </div>
    </div>
  );
};