import { useState, useRef, useEffect } from 'react';
import { Send, User, Zap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { ChatMessage } from '../types';
import { useChat } from '../ChatContext';

const suggestedPrompts = [
  { title: "Resumen de contratos", description: "¿Cuántos contratos tengo y quiénes son los arrendatarios y cual es el monto de arrendamiento?" },
  { title: "Vencimientos próximos", description: "Identifica contratos que tienen fecha de vencimiento para dentro de los próximos 30 días." },
  { title: "Análisis de rentas", description: "¿Cuál es el monto total de renta mensual en todos mis contratos en MXN?" },
];

interface ChatContainerProps {
  messages: ChatMessage[];
  isThinking: boolean;
  thinkingStep: string;
  onSessionCreated: () => void;
}

export default function ChatContainer({ 
  messages, isThinking, thinkingStep, onSessionCreated 
}: ChatContainerProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { sendMessage } = useChat();

  useEffect(() => {
    if (scrollRef.current) {
      const { scrollHeight, clientHeight } = scrollRef.current;
      scrollRef.current.scrollTo({ top: scrollHeight - clientHeight, behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  const handleSend = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() || isThinking) return;
    setInput('');
    await sendMessage(messageText);
    if (onSessionCreated) onSessionCreated(); 
  };

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto relative font-sans">
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto px-6 py-10 space-y-8 scrollbar-hide"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
            <Zap size={48} className="text-accent-electric animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              {suggestedPrompts.map((p, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSend(p.description)} 
                  disabled={isThinking}
                  className="bg-white/2 border border-white/5 p-5 rounded-2xl text-left hover:border-accent-electric/50 transition-all shadow-xl disabled:opacity-50"
                >
                  <p className="text-sm font-bold text-gray-200 mb-1">{p.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
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
                    "rounded-3xl px-6 py-5 text-sm leading-7 break-words shadow-2xl transition-all border-none antialiased",
                    msg.role === 'user' ? "bg-accent-electric text-black font-semibold rounded-tr-none" : "bg-white/2 text-gray-200 rounded-tl-none font-medium"
                  )}>
                    {msg.role === 'assistant' && msg.content === '' ? (
                      <div className="space-y-4 w-full">
                        <div className="flex items-center gap-3 text-accent-electric/60 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                          <Loader2 className="animate-spin w-3 h-3" />
                          {thinkingStep}
                        </div>
                        <div className="space-y-3 animate-pulse">
                          <div className="h-2 bg-accent-electric/10 rounded-full w-full"></div>
                          <div className="h-2 bg-accent-electric/10 rounded-full w-[90%]"></div>
                        </div>
                      </div>
                    ) : msg.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-table:border prose-table:border-white/10 prose-th:bg-white/5 prose-th:p-2 prose-td:p-2 prose-td:border-t prose-td:border-white/5 prose-table:my-6">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
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

      <footer className="px-6 pb-10 pt-4 shrink-0 bg-transparent">
        <div className={cn(
          "relative bg-white/5 border border-white/10 rounded-3xl p-2 flex items-center gap-3 transition-all shadow-2xl backdrop-blur-md",
          isThinking ? "opacity-50 grayscale cursor-not-allowed border-white/5" : "focus-within:border-accent-electric/30"
        )}>
          <textarea
            rows={1} value={input}
            disabled={isThinking}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
            placeholder={isThinking ? "IA procesando reporte..." : "Pregunta sobre tu portafolio legal..."}
            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-gray-200 py-3 px-4 text-sm resize-none shadow-none disabled:cursor-not-allowed"
          />
          <button 
            onClick={() => handleSend()} 
            disabled={isThinking || !input.trim()}
            className="p-4 bg-accent-electric text-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
          >
            {isThinking ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </footer>
    </div>
  );
}
