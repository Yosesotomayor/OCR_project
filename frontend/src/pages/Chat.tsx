import { useState, useEffect } from 'react';
import ChatContainer from '../components/ChatContainer';
import { PlusCircle } from 'lucide-react';
import { ChatMessage } from '../types';

const CHAT_HISTORY_KEY = 'chatHistory';

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    return savedHistory ? JSON.parse(savedHistory) : [];
  });
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  const handleNewChat = () => {
    setMessages([]);
    setIsThinking(false);
    localStorage.removeItem(CHAT_HISTORY_KEY); // Clear history from localStorage
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-[#050505]">
      {/* Efecto de luz ambiental en el fondo */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent-electric/5 to-transparent pointer-events-none" />
      
      <div className="p-8 border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Asistente Inteligente</h1>
            <p className="text-gray-400 text-xs mt-1 font-medium">
              Conversa con tu base de conocimientos privada con tecnología RAG
            </p>
          </div>
          {/* Botón de Nuevo Chat */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 px-4 py-2 bg-accent-electric text-black rounded-full text-sm font-medium hover:bg-accent-electric/80 transition-colors"
          >
            <PlusCircle size={18} />
            Nuevo Chat
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <ChatContainer 
          messages={messages}
          setMessages={setMessages}
          isThinking={isThinking}
          setIsThinking={setIsThinking}
        />
      </div>
    </div>
  );
}