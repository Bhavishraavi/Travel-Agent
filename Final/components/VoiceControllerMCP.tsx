/**
 * VoiceControllerMCP - Hybrid Mode: Gemini Voice + MCP Backend
 * 
 * Uses Gemini ONLY for voice-to-text transcription
 * Sends text to MCP backend for AI processing with Claude/Bedrock
 */

import { useState, useEffect, useRef } from 'react';
import { MicrophoneIcon, StopCircleIcon, SparklesIcon } from './IconComponents';
import { startHybridMCPSession, resetMCPSession, ttsService } from '../services/mcpGeminiService';
import { LiveSession, Transcript } from '../types';

interface VoiceControllerMCPProps {
  handleTranscriptUpdate: (speaker: 'user' | 'ai', textChunk: string, isFinal: boolean) => void;
  setVisualData: (data: any) => void;
  setViewMode: (mode: 'itinerary' | 'flights' | 'hotels' | 'hotel-booking' | 'flight-booking' | 'loading' | 'search') => void;
  setIsThinking: (isThinking: boolean) => void;
  isVoiceActive: boolean;
  setIsVoiceActive: (active: boolean) => void;
  transcripts: Transcript[];
  isThinking: boolean;
}

export const VoiceControllerMCP = ({
  handleTranscriptUpdate,
  setVisualData,
  setViewMode,
  setIsThinking,
  isVoiceActive,
  setIsVoiceActive,
  transcripts,
  isThinking,
}: VoiceControllerMCPProps) => {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTTSMuted, setIsTTSMuted] = useState(false);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  const startSession = async () => {
    try {
      setError(null);
      resetMCPSession(); // Start fresh session
      
      const newSession = await startHybridMCPSession({
        handleTranscriptUpdate,
        setVisualData,
        setViewMode,
        setIsThinking,
        onSessionEnd: () => {
          setIsVoiceActive(false);
          setSession(null);
        },
      });
      
      setSession(newSession);
      setIsVoiceActive(true);
    } catch (err: any) {
      console.error('Failed to start hybrid MCP session:', err);
      setError(err.message || 'Failed to start session');
      setIsVoiceActive(false);
    }
  };

  const stopSession = () => {
    if (session) {
      session.close();
      setSession(null);
    }
    ttsService.cancel(); // Stop any ongoing speech
    setIsVoiceActive(false);
  };

  const toggleTTS = () => {
    const newMutedState = ttsService.toggleMute();
    setIsTTSMuted(newMutedState);
  };

  const toggleSession = () => {
    if (isVoiceActive) {
      stopSession();
    } else {
      startSession();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (session) {
        session.close();
      }
    };
  }, [session]);

  // Auto-scroll transcripts
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div className="flex flex-col h-full">
      {!isVoiceActive ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            🤖 MCP Mode + Voice
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
            Voice-to-text by <span className="font-semibold">Gemini</span><br />
            AI processing by <span className="font-semibold">Claude (AWS Bedrock)</span> + <span className="font-semibold">MCP Router</span>
          </p>
          <button
            onClick={startSession}
            className="px-8 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold shadow-lg transition-all"
          >
            <div className="flex items-center gap-3">
              <MicrophoneIcon className="w-6 h-6" />
              <span>Start MCP Voice Session</span>
            </div>
          </button>
          {error && (
            <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col h-full p-4">
          {/* Transcripts Display */}
          <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4">
            {transcripts.map((t, i) => (
              <div key={i} className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${
                  t.speaker === 'user' 
                    ? 'bg-purple-500 text-white rounded-br-none' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                }`}>
                  <p className={t.isFinal === false ? 'opacity-70' : ''}>{t.text}</p>
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-bl-none flex items-center space-x-2">
                  <SparklesIcon className="h-5 w-5 animate-pulse" />
                  <span>Processing with MCP + Claude...</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Control Bar */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-semibold">🎤 Voice:</span> Gemini |{' '}
                <span className="font-semibold">🤖 AI:</span> Claude (MCP)
              </div>
              <div className="flex items-center gap-3">
                {/* TTS Mute/Unmute Button */}
                <button
                  onClick={toggleTTS}
                  className={`flex items-center justify-center w-12 h-12 rounded-full shadow-md transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 ${
                    isTTSMuted
                      ? 'bg-gray-400 hover:bg-gray-500 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                  title={isTTSMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
                >
                  <span className="text-xl">{isTTSMuted ? '🔇' : '🔊'}</span>
                </button>
                {/* Stop Session Button */}
                <button
                  onClick={stopSession}
                  className="flex items-center justify-center w-16 h-16 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-red-300"
                >
                  <StopCircleIcon className="w-10 h-10" />
                </button>
              </div>
            </div>
            {error && (
              <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded mt-2">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

