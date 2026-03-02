import { useState, useRef, useEffect } from 'react';
import { Send, User, Zap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { ChatMessage } from '../types';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL;

const suggestedPrompts = [
  { title: "Resumen de contratos", description: "¿Cuántos contratos tengo y quiénes son los arrendatarios?" },
  { title: "Vencimientos próximos", description: "Identifica contratos que vencen en los próximos 30 días." },
  { title: "Análisis de rentas", description: "¿Cuál es el monto total de renta mensual en MXN?" },
];

interface ChatContainerProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isThinking: boolean;
  setIsThinking: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ChatContainer({ messages, setMessages, isThinking, setIsThinking }: ChatContainerProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  const handleSend = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() || !token) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toLocaleTimeString() }]);

    try {
      const response = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ question: messageText, history: messages.slice(-5) })
      });

      if (!response.ok) throw new Error("GPU Offline");
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulatedContent += decoder.decode(value, { stream: true });
          setMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: accumulatedContent } : msg));
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: "⚠️ Error de conexión con la GPU. Por favor, verifica que Ollama esté corriendo." } : msg));
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto px-6 relative font-sans antialiased">
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-10 space-y-8 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
            <Zap size={48} className="text-accent-electric animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
              {suggestedPrompts.map((p, i) => (
                <button key={i} onClick={() => handleSend(p.description)} className="bg-white/2 border border-white/5 p-5 rounded-2xl text-left hover:border-accent-electric/50 transition-all group shadow-xl">
                  <p className="text-sm font-bold text-gray-200 mb-1">{p.title}</p>
                  <p className="text-xs text-gray-500">{p.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                key={msg.id}
                className={cn("flex gap-5 max-w-[85%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto")}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-lg", msg.role === 'user' ? "bg-accent-electric border-white/20" : "bg-white/5 border-white/10")}>
                  {msg.role === 'user' ? <User size={18} className="text-black" /> : <Zap size={18} className="text-accent-electric" />}
                </div>
                
                <div className="space-y-2 flex-grow">
                  <div className={cn(
                    "rounded-3xl px-6 py-5 text-sm leading-7 break-words shadow-2xl transition-all border-none",
                    msg.role === 'user' ? "bg-accent-electric text-black font-semibold rounded-tr-none" : "bg-white/2 text-gray-200 rounded-tl-none font-medium"
                  )}>
                    {msg.role === 'assistant' && msg.content === '' ? (
                      <div className="space-y-3 w-full animate-pulse">
                        <div className="h-2.5 bg-accent-electric/20 rounded-full w-full"></div>
                        <div className="h-2.5 bg-accent-electric/20 rounded-full w-[90%]"></div>
                        <div className="h-2.5 bg-accent-electric/20 rounded-full w-[75%]"></div>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <footer className="pb-10 pt-4">
        <div className="relative bg-white/2 border border-white/5 rounded-3xl p-2 flex items-center gap-3 focus-within:border-accent-electric/30 transition-all shadow-2xl">
          <textarea
            rows={1} value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
            placeholder="Pregunta sobre tu portafolio legal..."
            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-gray-200 py-3 px-4 text-sm resize-none shadow-none"
          />
          <button onClick={() => handleSend()} className="p-4 bg-accent-electric text-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg">
            <Send size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}
