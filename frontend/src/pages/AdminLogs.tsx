import { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, ShieldCheck, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

const API_URL = import.meta.env.VITE_API_URL;

export default function AdminLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    
    try {
      const response = await fetch(`${API_URL}/admin/logs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setLogs(data.logs);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setLogs(prev => prev + '\n[ERROR] Fallo en la conexión con el servidor de logs.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => fetchLogs(true), 10000); // Auto refresh cada 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="p-10 space-y-8 h-full flex flex-col">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2 italic flex items-center gap-3">
            <TerminalIcon className="text-accent-electric w-8 h-8" />
            Consola de Comando
          </h1>
          <p className="text-gray-500 text-sm">Monitoreo de eventos en tiempo real y carga de modelos OCR.</p>
        </div>

        <button 
          onClick={() => fetchLogs()}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition-all"
          disabled={isRefreshing}
        >
          {isRefreshing ? <Loader2 className="animate-spin w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
          Actualizar Ahora
        </button>
      </header>

      <div className="flex-1 bg-[#020202] border border-[#1f1f1f] rounded-2xl overflow-hidden shadow-2xl flex flex-col font-mono text-sm relative group">
        {/* Terminal Header */}
        <div className="bg-[#0a0a0a] border-b border-[#1f1f1f] px-4 py-3 flex items-center justify-between">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
            <div className="w-3 h-3 rounded-full bg-accent-electric/20 border border-accent-electric/40" />
          </div>
          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">system.log — bash</span>
          <div className="flex items-center gap-2 text-[10px] text-emerald-500/50">
            <ShieldCheck size={12} />
            Secure Session
          </div>
        </div>

        {/* Terminal Content */}
        <div 
          ref={scrollRef}
          className="flex-1 p-6 overflow-y-auto space-y-1 selection:bg-accent-electric/30 scrollbar-thin scrollbar-thumb-white/10"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p className="animate-pulse">Estableciendo enlace con el kernel...</p>
            </div>
          ) : (
            <>
              {logs.split('\n').map((line, i) => (
                <div key={i} className="flex gap-4 group/line">
                  <span className="text-gray-700 select-none w-8 text-right italic">{i + 1}</span>
                  <span className={cn(
                    "break-all",
                    line.includes('ERROR') ? "text-red-400" : 
                    line.includes('INFO') ? "text-accent-electric" : 
                    line.includes('DEBUG') ? "text-gray-500" : "text-gray-300"
                  )}>
                    {line}
                  </span>
                </div>
              ))}
              <div className="flex gap-4 animate-pulse pt-2">
                <span className="text-gray-700 select-none w-8 text-right">{logs.split('\n').length + 1}</span>
                <span className="text-accent-electric">_</span>
              </div>
            </>
          )}
        </div>

        {/* Status Bar */}
        <div className="bg-[#0a0a0a] border-t border-[#1f1f1f] px-6 py-3 flex items-center gap-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-accent-electric animate-pulse" />
             PaddleOCR: Warm-up
           </div>
           <div className="flex items-center gap-2">
             <AlertCircle size={12} className="text-yellow-500/60" />
             Llama 3.2: Ready
           </div>
           <div className="ml-auto text-gray-700">
             UTF-8 | LF | LeaseLens_Kernel_v2.6
           </div>
        </div>
      </div>
    </div>
  );
}
