
import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon } from './IconComponents';
import { sendChatMessage } from '../services/geminiService';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

export const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessages([{ sender: 'bot', text: "Hi there! How can I help you with your travel plans?" }]);
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (chatContentRef.current) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: ChatMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const botResponse = await sendChatMessage(input, messages);
      setMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages(prev => [...prev, { sender: 'bot', text: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Chat
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white dark:bg-gray-800 shadow-2xl rounded-lg flex flex-col z-50">
      <div className="p-4 bg-blue-500 text-white flex justify-between items-center rounded-t-lg">
        <h3 className="font-bold">Travel Assistant</h3>
        <button onClick={() => setIsOpen(false)} className="font-bold text-xl">&times;</button>
      </div>
      <div ref={chatContentRef} className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-3 py-2 rounded-lg ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
              {msg.text}
            </div>
          </div>
        ))}
         {isLoading && <div className="flex justify-start"><div className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700">...</div></div>}
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question..."
          className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-gray-700 dark:border-gray-600"
        />
        <button onClick={handleSend} disabled={isLoading} className="ml-2 p-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-400">
          <PaperAirplaneIcon className="w-6 h-6"/>
        </button>
      </div>
    </div>
  );
};
