import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Loader2, User, Bot, FileUp, Zap, Info, ExternalLink } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../lib/utils';
import { ChatMessage } from '../types';

const SUGGESTED_INQUIRIES = [
  "¿Qué contratos tienen cláusulas de rescisión por falta de pago?",
  "Resúmeme el incremento anual por inflación del Contrato ID-88.",
  "¿Quiénes son los avales en los contratos de la zona Norte?"
];

export default function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Bienvenido a LeaseLens AI. Soy tu analista experto en contratos. ¿Qué información necesitas extraer de tu portafolio hoy?',
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFilePreview(acceptedFiles[0].name);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    noClick: true,
    noKeyboard: true
  });

  const handleSend = (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() && !filePreview) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setFilePreview(null);
    setIsThinking(true);

    // Simulate AI response with Source Attribution
    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'He analizado la cláusula de incremento anual en el contrato solicitado. Basado en el INPC, el ajuste para este periodo es del 4.2%, aplicable a partir del próximo mes de facturación.',
        timestamp: new Date().toLocaleTimeString(),
        sources: ['CT-1024_GlobalLogistics.pdf', 'Anexo_A_Ajustes.docx']
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsThinking(false);
    }, 2000);
  };

  return (
    <div 
      {...getRootProps()}
      className={cn(
        "flex flex-col h-full max-w-5xl mx-auto px-6 transition-all duration-300 relative",
        isDragActive && "border-2 border-accent-electric shadow-[0_0_40px_rgba(168,85,247,0.2)] bg-accent-electric/5 rounded-3xl"
      )}
    >
      <input {...getInputProps()} />

      {isDragActive && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-accent-electric text-white px-8 py-4 rounded-2xl font-black text-xl flex items-center gap-3 animate-bounce shadow-2xl">
            <FileUp size={24} />
            Soltar para Ingestar Contrato
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-10 space-y-10 scrollbar-hide"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={cn(
              "flex gap-6 max-w-[85%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform hover:scale-110",
              msg.role === 'user' ? "bg-accent-electric shadow-lg shadow-accent-electric/20" : "bg-[#0a0a0a] border border-[#1f1f1f]"
            )}>
              {msg.role === 'user' ? <User size={20} /> : <Zap size={20} className="text-accent-electric fill-accent-electric" />}
            </div>
            
            <div className="space-y-3">
              <div className={cn(
                "rounded-2xl px-5 py-4 text-[13px] leading-relaxed shadow-sm",
                msg.role === 'user' 
                  ? "bg-accent-electric text-white rounded-tr-none font-medium" 
                  : "bg-[#0a0a0a] border border-[#1f1f1f] text-gray-200 rounded-tl-none border-l-2 border-l-accent-electric"
              )}>
                {msg.content}
                <div className="text-[10px] opacity-40 mt-3 text-right font-mono italic">
                  {msg.timestamp}
                </div>
              </div>

              {msg.sources && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest mr-1">Fuentes:</span>
                  {msg.sources.map((src, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] text-accent-electric font-bold hover:bg-white/10 cursor-pointer transition-all">
                      <Info size={10} />
                      {src}
                      <ExternalLink size={8} className="opacity-40" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-6 mr-auto animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] flex items-center justify-center shadow-lg">
              <Zap size={20} className="text-accent-electric fill-accent-electric" />
            </div>
            <div className="bg-[#0a0a0a] border border-[#1f1f1f] border-l-2 border-l-accent-electric rounded-2xl rounded-tl-none px-6 py-4 flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-accent-electric" />
              <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Analizando inteligencia contractual...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Inquiries */}
      {messages.length < 3 && !isThinking && (
        <div className="mb-6 space-y-3 shrink-0">
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest ml-1">Consultas Sugeridas</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_INQUIRIES.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                className="px-4 py-2 bg-transparent border border-accent-electric/20 rounded-xl text-[11px] text-accent-electric hover:bg-accent-electric/10 hover:border-accent-electric/40 transition-all font-medium text-left max-w-sm"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="pb-10 pt-4 shrink-0">
        {filePreview && (
          <div className="mb-4 flex items-center gap-2 bg-accent-electric/10 border border-accent-electric/20 rounded-xl px-4 py-3 w-fit animate-in fade-in slide-in-from-bottom-2">
            <FileUp size={14} className="text-accent-electric" />
            <span className="text-xs text-accent-electric font-bold">{filePreview}</span>
            <button onClick={() => setFilePreview(null)} className="text-accent-electric/40 hover:text-white ml-3 text-lg leading-none">×</button>
          </div>
        )}
        
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-accent-electric/20 blur opacity-0 group-focus-within:opacity-100 transition-opacity rounded-[22px]" />
          <div className="relative bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-2.5 flex items-end gap-3 focus-within:border-accent-electric/50 transition-all shadow-2xl">
            <label className="p-3 text-gray-500 hover:text-accent-electric cursor-pointer transition-colors hover:bg-white/5 rounded-xl">
              <Paperclip size={22} />
              <input type="file" className="hidden" onChange={(e) => setFilePreview(e.target.files?.[0]?.name || null)} />
            </label>
            
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Pregunte sobre cláusulas, vencimientos o MRR..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-gray-200 placeholder:text-gray-700 py-3.5 px-2 text-[13px] resize-none max-h-48 scrollbar-hide font-medium leading-relaxed"
            />
            
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() && !filePreview}
              className="p-3.5 bg-accent-electric hover:bg-accent-electric-hover disabled:bg-[#1f1f1f] disabled:text-gray-700 text-white rounded-xl transition-all shadow-lg active:scale-95 group/btn"
            >
              <Send size={22} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center mt-4 px-2">
          <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest">
            Powered by RAG Neural Engine
          </p>
          <p className="text-[9px] text-gray-800 italic">
            Verifica siempre las cláusulas legales críticas.
          </p>
        </div>
      </div>
    </div>
  );
}
