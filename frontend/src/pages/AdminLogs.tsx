import { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, ShieldCheck, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

const API_URL = import.meta.env.VITE_API_URL;

export default function AdminLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<string>('');
  const [command, setCommand] = useState('');
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
      // Solo actualizamos si no estamos en medio de una sesión de comandos interactiva
      // o añadimos los logs del sistema al historial actual.
      setLogs(prev => {
        const lines = data.logs.split('\n');
        const prevLines = prev.split('\n');
        // Evitar duplicados simples
        if (prevLines.includes(lines[lines.length - 1])) return prev;
        return prev + '\n' + data.logs;
      });
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

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    
    const cmd = command.toLowerCase().trim();
    let response = '';
    
    if (cmd === 'ping') response = '[PONG] Kernel Latency: 4ms | Connection: Stable';
    else if (cmd === 'clear') { setLogs('Terminal cleared. Awaiting system events...'); setCommand(''); return; }
    else if (cmd === 'help') response = 'Available commands: ping, metrics, vram, routes, agents, whoami, clear';
    else if (cmd === 'whoami') response = `Current Admin Session: Active`;
    else if (cmd === 'routes' || cmd === 'agents' || cmd === 'metrics' || cmd === 'vram') {
      try {
        const res = await fetch(`${API_URL}/admin/system/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (cmd === 'routes') response = `[ENDPOINTS]\n${data.routes.join('\n')}`;
        else if (cmd === 'agents') response = `[AGENTS HEALTH] Status: ${data.agents}`;
        else if (cmd === 'vram') response = `[GPU TELEMETRY] Loaded Models: ${data.metrics.vram_active_models}`;
        else if (cmd === 'metrics') {
          response = `[SYSTEM METRICS]\n` +
                     `> Usuarios Registrados: ${data.metrics.usuarios}\n` +
                     `> Contratos en DB: ${data.metrics.contratos_totales}\n` +
                     `> Procesamientos Exitosos: ${data.metrics.ocr_exitosos}\n` +
                     `> Eficiencia OCR: ${((data.metrics.ocr_exitosos / data.metrics.contratos_totales) * 100 || 0).toFixed(1)}%`;
        }
      } catch (err) {
        response = '[ERROR] Failed to fetch system telemetry from kernel.';
      }
    }
    else response = `[SHELL] Command not found: ${cmd}. Type 'help' for options.`;

    setLogs(prev => prev + `\n> ${command}\n${response}`);
    setCommand('');
  };

  return (
    <div className="p-10 space-y-8 h-full flex flex-col">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2 italic flex items-center gap-3">
            <TerminalIcon className="text-accent-electric w-8 h-8" />
            Consola de Comando
          </h1>
          <p className="text-gray-500 text-sm">Monitoreo de eventos en tiempo real y terminal interactiva del kernel.</p>
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
          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">leaselens-kernel — bash</span>
          <div className="flex items-center gap-2 text-[10px] text-emerald-500/50">
            <ShieldCheck size={12} />
            Encrypted Session
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
                    line.startsWith('>') ? "text-yellow-500 font-bold" :
                    line.includes('ERROR') ? "text-red-400" : 
                    line.includes('INFO') || line.includes('[SYS]') || line.includes('[API]') ? "text-accent-electric" : 
                    line.includes('DEBUG') ? "text-gray-500" : "text-gray-300"
                  )}>
                    {line}
                  </span>
                </div>
              ))}
              <form onSubmit={handleCommand} className="flex gap-4 pt-2">
                <span className="text-gray-700 select-none w-8 text-right italic">{logs.split('\n').length + 1}</span>
                <span className="text-accent-electric font-bold">{'>'}</span>
                <input 
                  autoFocus
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-accent-electric p-0 caret-accent-electric font-mono"
                  placeholder="Escribe un comando (help)..."
                />
              </form>
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
             Llama 3.1: Ready
           </div>
           <div className="ml-auto text-gray-700">
             UTF-8 | LF | LeaseLens_v2.6_Stable
           </div>
        </div>
      </div>
    </div>
  );
}
