import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Loader2, User, Zap, Info, FileUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { ChatMessage } from '../types';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL;

const suggestedPrompts = [
  { 
    title: "Revisar cláusulas de mantenimiento en plazas comerciales", 
    description: "Identifica responsabilidades y costos de mantenimiento en contratos de retail." 
  },
  { 
    title: "Calcular renta variable basada en ventas", 
    description: "Analiza cómo se calcula la renta variable según el desempeño de ventas." 
  },
  { 
    title: "Verificar vigencia y periodos de gracia", 
    description: "Obtén fechas clave de inicio, fin y periodos de gracia en los contratos." 
  },
  { 
    title: "Extraer condiciones de exclusividad de marca", 
    description: "Busca cláusulas que limiten la presencia de marcas competidoras." 
  },
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
  const { token } = useAuth(); // Obtener token del hook

  // --- LÓGICA DE SCROLL ---
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (scrollContainer) {
      // Check if the user is already near the bottom (e.g., within 100px of the bottom)
      const isScrolledToBottom = scrollContainer.scrollHeight - scrollContainer.clientHeight <= scrollContainer.scrollTop + 100;
      
      // Only scroll if near bottom or if it's the assistant's message being streamed
      const lastMessage = messages[messages.length - 1];
      const isAssistantStreaming = isThinking && lastMessage?.role === 'assistant' && lastMessage?.content === '';

      if (isScrolledToBottom || isAssistantStreaming) {
        scrollContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [messages, isThinking]);

  // --- LÓGICA DE STREAMING ---
  const handleSend = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    // Token check
    if (!token) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Error: No autenticado. Por favor, inicie sesión de nuevo.",
        timestamp: new Date().toLocaleTimeString(),
      }]);
      return;
    }

    // 1. Agregar mensaje del usuario
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    // 2. Crear un mensaje vacío para el asistente que iremos llenando
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
    }]);

    try {
      // 3. Petición al Backend con historial y TOKEN
      const response = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // <-- TOKEN AÑADIDO
        },
        body: JSON.stringify({
          question: messageText,
          history: messages.slice(-5) // Mandamos los últimos 5 mensajes para contexto
        })
      });

      if (!response.ok) { // Manejo de error de autenticación
        if (response.status === 401) {
          throw new Error("No autenticado. Por favor, inicie sesión de nuevo.");
        }
        throw new Error("Error en la respuesta del servidor.");
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      // setIsThinking(false); // REMOVED: This was prematurely hiding the loading indicator

      // 4. Leer el stream palabra por palabra
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;

        // Actualizar el último mensaje (el del asistente) en tiempo real
        setMessages(prev => prev.map(msg => 
          msg.id === assistantId ? { ...msg, content: accumulatedContent } : msg
        ));
      }

    } catch (err) {
      console.error("Streaming Error:", err);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantId ? { ...msg, content: "Error de conexión con la GPU." } : msg
      ));
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto px-6 relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-10 space-y-8 scrollbar-hide" style={{ overflowAnchor: 'auto' }}>
        {messages.length === 0 && !isThinking ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <div className="mb-8 text-center">
                  <Zap size={40} className="mx-auto mb-4 text-accent-electric" />
                  <h2 className="text-2xl font-bold text-gray-200 mb-2">Asistente Inteligente</h2>
                  <p className="text-sm max-w-md mx-auto">¿Cómo puedo ayudarte a analizar tus documentos hoy? Puedes empezar con una de estas sugerencias:</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl w-full px-4">
                  {suggestedPrompts.map((prompt, i) => (
                      <motion.button 
                          key={i}
                          onClick={() => handleSend(prompt.title)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                          className="bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-xl text-left text-sm text-gray-300 hover:border-accent-electric/50 transition-all duration-200 ease-in-out"
                      >
                          <p className="font-medium">{prompt.title}</p>
                          <p className="text-xs text-gray-400 mt-1">{prompt.description}</p>
                      </motion.button>
                  ))}
              </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={msg.id}
                className={cn("flex gap-5 max-w-[90%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto")}
              >
                {/* Avatar con diseño Mifel-Tech */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all shadow-lg flex-shrink-0", // Added flex-shrink-0
                  msg.role === 'user' ? "bg-accent-electric border-white/20" : "bg-[#0a0a0a] border-[#1f1f1f]"
                )}>
                  {msg.role === 'user' ? <User size={18} /> : <Zap size={18} className="text-accent-electric fill-accent-electric" />}
                </div>
                
                <div className="space-y-2 flex-grow overflow-hidden"> {/* Added overflow-hidden here */}
                  <div className={cn(
                    "rounded-2xl px-5 py-4 text-[13px] leading-relaxed shadow-2xl transition-all break-words", // Added break-words
                    msg.role === 'user' 
                      ? "bg-accent-electric text-white rounded-tr-none font-medium" 
                      : "bg-[#0a0a0a] border border-[#1f1f1f] text-gray-200 rounded-tl-none border-l-2 border-l-accent-electric"
                  )}>
                    {/* El contenido fluye aquí */}
                    {msg.content}
                    
                    <div className="text-[9px] opacity-30 mt-3 text-right font-mono italic">
                      {msg.timestamp}
                    </div>
                  </div>

                  {/* Chips de fuentes dinámicos */}
                  {msg.sources && msg.sources.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2">
                      {msg.sources.map((src, i) => (
                        <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] text-accent-electric font-bold">
                          {src}
                        </span>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Loading indicator when AI is thinking */}
      {isThinking && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="flex justify-start gap-5 max-w-[90%] mr-auto py-2"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-[#0a0a0a] border-[#1f1f1f] flex-shrink-0">
            <Zap size={18} className="text-accent-electric fill-accent-electric" />
          </div>
          <div className="rounded-2xl px-5 py-4 text-[13px] leading-relaxed shadow-2xl bg-[#0a0a0a] border border-[#1f1f1f] text-gray-200 rounded-tl-none border-l-2 border-l-accent-electric">
            <Loader2 className="h-5 w-5 animate-spin text-accent-electric" />
            <span className="ml-2">La IA está pensando...</span>
          </div>
        </motion.div>
      )}

      {/* Input optimizado para mayor control */}
      <footer className="pb-10 pt-4">
        <div className="relative group bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-2 flex items-center gap-2 transition-all">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
            placeholder="Pregunta sobre tus contratos..."
            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none !important focus:border-transparent !important text-gray-200 py-3 px-4 text-sm resize-none"
          />
          <button onClick={() => handleSend()} className="p-3 bg-accent-electric text-black rounded-xl hover:scale-105 active:scale-95 transition-all">
            <Send size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}