import { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { MessageSquare, Plus, Trash2, Zap, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import ChatContainer from '../components/ChatContainer';
import { ChatMessage } from '../types';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL;

interface IChatSession {
  id: string;
  title: string;
  created_at: string;
}

export default function Chat() {
  const [sessions, setSessions] = useState<IChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    return localStorage.getItem('last_active_chat_id');
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  // MEMORIA DE SIDEBAR: Leer del localStorage al iniciar
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('chat_sidebar_open');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const { token } = useAuth();

  // Guardar preferencia de sidebar
  useEffect(() => {
    localStorage.setItem('chat_sidebar_open', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  // Guardar ID del chat activo
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('last_active_chat_id', activeChatId);
    } else {
      localStorage.removeItem('last_active_chat_id');
    }
  }, [activeChatId]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/chats`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        
        // Si hay un ID guardado pero no hemos cargado los mensajes aún
        const savedId = localStorage.getItem('last_active_chat_id');
        if (savedId && !activeChatId) {
          loadChat(savedId);
        }
      }
    } catch (err) { console.error(err); }
  }, [token, activeChatId]);

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) return setEditingChatId(null);
    try {
      await fetch(`${API_URL}/chats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: editTitle })
      });
      setEditingChatId(null);
      fetchSessions();
    } catch (err) { console.error(err); }
  };

  const loadChat = async (chatId: string) => {
    setActiveChatId(chatId);
    setMessages([]);
    try {
      const res = await fetch(`${API_URL}/chats/${chatId}/messages`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const history = await res.json();
        setMessages(history.map((m: any) => ({
          id: Math.random().toString(),
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp).toLocaleTimeString()
        })));
      }
    } catch (err) { console.error(err); }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Borrar chat?")) {
      await fetch(`${API_URL}/chats/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (activeChatId === id) startNewChat();
      fetchSessions();
    }
  };

  useEffect(() => { 
    if (token) fetchSessions(); 
  }, [token, fetchSessions]);

  // Cargar el chat guardado al inicio una sola vez cuando las sesiones estén listas
  useEffect(() => {
    const savedId = localStorage.getItem('last_active_chat_id');
    if (savedId && sessions.length > 0 && !activeChatId) {
      const sessionExists = sessions.some(s => s.id === savedId);
      if (sessionExists) {
        loadChat(savedId);
      } else {
        localStorage.removeItem('last_active_chat_id');
      }
    }
  }, [sessions]);

  return (
    <div className="flex h-full bg-[#050505] text-white font-sans overflow-hidden relative">
      {/* BOTON FLOTANTE PARA ABRIR SIDEBAR SI ESTA CERRADO */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-50 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 border border-white/5 transition-all shadow-2xl"
          title="Abrir Historial"
        >
          <PanelLeftOpen size={20} />
        </button>
      )}

      {/* SIDEBAR COLAPSABLE */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 288 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-[#0a0a0a]/50 border-r border-white/5 flex flex-col backdrop-blur-xl shrink-0 overflow-hidden relative"
      >
        <div className="p-4 flex items-center justify-between">
          <button 
            onClick={startNewChat}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold hover:bg-accent-electric/10 hover:text-accent-electric transition-all"
          >
            <Plus size={16} /> Nuevo Chat
          </button>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="ml-2 p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            title="Cerrar Historial"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-4 px-2">Recientes</p>
          {sessions.map((s) => (
            <div 
              key={s.id}
              onClick={() => loadChat(s.id)}
              className={cn(
                "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border border-transparent",
                activeChatId === s.id ? "bg-accent-electric/10 border-accent-electric/20 text-accent-electric shadow-lg" : "hover:bg-white/5 text-gray-400"
              )}
            >
              <div className="flex items-center gap-3 truncate flex-1">
                <MessageSquare size={16} className={activeChatId === s.id ? "text-accent-electric" : "text-gray-600"} />
                {editingChatId === s.id ? (
                  <input 
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRename(s.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(s.id)}
                    className="bg-black/40 border border-accent-electric/30 rounded px-2 py-1 text-xs w-full outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-xs font-medium truncate">{s.title}</span>
                )}
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!editingChatId && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setEditingChatId(s.id); setEditTitle(s.title); }}
                    className="p-1 hover:text-accent-electric transition-colors"
                  >
                    <Plus size={14} className="rotate-45" /> {/* Icono de edición simple */}
                  </button>
                )}
                <button 
                  onClick={(e) => deleteChat(s.id, e)}
                  className="p-1 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-white/5 shrink-0">
          <div className="flex items-center gap-2 text-gray-600">
            <Zap size={14} className="fill-accent-electric text-accent-electric" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Premium Intelligence</span>
          </div>
        </div>
      </motion.aside>

      {/* CONVERSACIÓN ACTIVA */}
      <main className="flex-1 flex flex-col relative min-w-0 h-full overflow-hidden">
        <ChatContainer 
          messages={messages} 
          setMessages={setMessages} 
          isThinking={isThinking} 
          setIsThinking={setIsThinking}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          onSessionCreated={fetchSessions}
        />
      </main>
    </div>
  );
}
