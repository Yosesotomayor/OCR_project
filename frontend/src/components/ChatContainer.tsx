import { useState, useRef, useEffect } from 'react';
import { Send, User, Zap, Loader2, ExternalLink, X, FileText, Filter, Check, Files } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../utils';
import { ChatMessage, Source } from '../types';
import { useChat } from '../ChatContext';
import { getLeaseUrl } from '../client/sdk.gen';

const suggestedPrompts = [
  { title: "Resumen de contratos", description: "¿Cuáles contratos tengo en Monterrey, quiénes son los arrendatarios y cual es el monto de arrendamiento?" },
  { title: "Vencimientos próximos", description: "Identifica contratos que tienen fecha de vencimiento para dentro de los próximos 30 días." },
  { title: "Análisis de rentas", description: "¿Cuáles contratos tienen renta arriba de 100,000 pesos?" },
];

const SourceChip = ({ source }: { source: Source }) => {
  const { leases } = useChat();
  const [isHovered, setIsHovered] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const lease = leases.find(l => l.filename === source.lease_filename);
  
  const handleOpenPreview = async () => {
    if (!lease?.id) return;
    try {
      const { data } = await getLeaseUrl({ path: { lease_id: lease.id } });
      if (data) {
        setPdfUrl(data as string);
        setIsPreviewOpen(true);
      }
    } catch (err) {
      console.error("Error fetching PDF URL:", err);
    }
  };

  return (
    <>
      <div className="relative inline-block group">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleOpenPreview}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:border-accent-electric/50 transition-all text-[10px] text-gray-400 hover:text-white group"
        >
          <FileText size={10} className="text-accent-electric" />
          <span className="truncate max-w-[120px]">{source.filename}</span>
        </motion.button>

        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 p-4 bg-[#111] border border-white/10 rounded-2xl shadow-2xl z-50 pointer-events-none"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <FileText size={12} className="text-accent-electric" />
                  <span className="text-[10px] font-bold text-gray-300 truncate">{source.filename}</span>
                </div>
                <p className="text-[10px] leading-relaxed text-gray-500 italic line-clamp-4">
                  "{source.text}"
                </p>
                <div className="flex items-center gap-1 text-[8px] text-accent-electric font-black uppercase tracking-tighter pt-1 opacity-70">
                  <ExternalLink size={8} /> Click para vista previa
                </div>
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#111] border-r border-b border-white/10 rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isPreviewOpen && pdfUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsPreviewOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full h-full max-w-6xl bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-4 flex items-center justify-between border-b border-white/5 bg-white/2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-electric/10 flex items-center justify-center">
                    <FileText size={16} className="text-accent-electric" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-200">{source.filename}</p>
                    <p className="text-[10px] text-gray-500">Vista previa del documento</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
              <div className="flex-1 bg-white/2 p-4">
                <iframe 
                  src={pdfUrl} 
                  className="w-full h-full rounded-2xl border border-white/5 shadow-inner"
                  title="PDF Preview"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

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
  const [selectedFilenames, setSelectedFilenames] = useState<string[]>([]);
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { sendMessage, leases } = useChat();

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
    await sendMessage(messageText, selectedFilenames.length > 0 ? selectedFilenames : undefined);
    if (onSessionCreated) onSessionCreated(); 
  };

  const toggleFile = (filename: string) => {
    setSelectedFilenames(prev => 
      prev.includes(filename) 
        ? prev.filter(f => f !== filename) 
        : [...prev, filename]
    );
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
                      <div className="flex flex-col gap-4">
                        <div className="prose prose-sm max-w-none prose-custom prose-table:border prose-table:border-white/10 prose-th:bg-white/5 prose-th:p-2 prose-td:p-2 prose-td:border-t prose-td:border-white/5 prose-table:my-6 prose-headings:font-bold prose-headings:tracking-tight prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-accent-electric/80 transition-all">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                            {msg.sources.map((source, idx) => (
                              <SourceChip key={idx} source={source} />
                            ))}
                          </div>
                        )}
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

      <footer className="px-6 pb-10 pt-4 shrink-0 bg-transparent relative">
        <AnimatePresence>
          {isFileSelectorOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full mb-4 left-6 right-6 bg-[#111] border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-150"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                <div className="flex items-center gap-2">
                  <Files size={16} className="text-accent-electric" />
                  <span className="text-xs font-bold text-gray-200">Filtrar por archivos ({selectedFilenames.length})</span>
                </div>
                <button 
                  onClick={() => setIsFileSelectorOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <div className="overflow-y-auto p-2 space-y-1 scrollbar-hide">
                {leases.length === 0 ? (
                  <p className="text-[10px] text-gray-500 text-center py-4">No hay documentos disponibles</p>
                ) : (
                  leases.map((lease) => (
                    <button
                      key={lease.id}
                      onClick={() => toggleFile(lease.filename)}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left group",
                        selectedFilenames.includes(lease.filename) 
                          ? "bg-accent-electric/10 border border-accent-electric/20" 
                          : "hover:bg-white/5 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText size={14} className={cn(
                          selectedFilenames.includes(lease.filename) ? "text-accent-electric" : "text-gray-500"
                        )} />
                        <span className={cn(
                          "text-xs truncate",
                          selectedFilenames.includes(lease.filename) ? "text-white font-medium" : "text-gray-400"
                        )}>{lease.filename}</span>
                      </div>
                      {selectedFilenames.includes(lease.filename) && (
                        <Check size={14} className="text-accent-electric shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
              {selectedFilenames.length > 0 && (
                <div className="p-2 border-t border-white/5 bg-white/2">
                  <button 
                    onClick={() => setSelectedFilenames([])}
                    className="w-full py-1.5 text-[10px] text-gray-500 hover:text-white transition-all uppercase font-bold tracking-widest"
                  >
                    Limpiar selección
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn(
          "relative bg-white/5 border border-white/10 rounded-3xl p-2 flex items-center gap-3 transition-all shadow-2xl backdrop-blur-md",
          isThinking ? "opacity-50 grayscale cursor-not-allowed border-white/5" : "focus-within:border-accent-electric/30"
        )}>
          <button
            onClick={() => setIsFileSelectorOpen(!isFileSelectorOpen)}
            disabled={isThinking}
            className={cn(
              "ml-2 p-3 rounded-2xl transition-all relative shrink-0",
              selectedFilenames.length > 0 
                ? "bg-accent-electric/20 text-accent-electric" 
                : "hover:bg-white/10 text-gray-400"
            )}
          >
            <Filter size={20} />
            {selectedFilenames.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-electric text-black text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0a0a0a]">
                {selectedFilenames.length}
              </span>
            )}
          </button>

          <textarea
            rows={1} value={input}
            disabled={isThinking}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
            placeholder={isThinking ? "IA procesando reporte..." : (selectedFilenames.length > 0 ? `Pregunta sobre ${selectedFilenames.length} documentos...` : "Pregunta sobre tu portafolio legal...")}
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
