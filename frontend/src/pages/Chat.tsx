import { useState, useEffect, useCallback } from 'react';
import { cn } from '../utils';
import { MessageSquare, Plus, Trash2, Zap, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import ChatContainer from '../components/ChatContainer';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../ChatContext';
import { motion } from 'framer-motion';
import { listChats, deleteChat as sdkDeleteChat } from '../client/sdk.gen';
import { type ChatRead } from '../client/types.gen';

export default function Chat() {
  const [sessions, setSessions] = useState<ChatRead[]>([]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('chat_sidebar_open');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const { token } = useAuth();
  const { 
    messages, isThinking, thinkingStep, 
    activeChatId, loadChat, startNewChat 
  } = useChat();

  useEffect(() => {
    localStorage.setItem('chat_sidebar_open', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const fetchSessions = useCallback(async () => {
    try {
      const { data } = await listChats();
      if (data) {
        setSessions(data);
      }
    } catch (err) { console.error(err); }
  }, []);

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Borrar chat?")) {
      try {
        await sdkDeleteChat({ path: { chat_id: id } });
        if (activeChatId === id) startNewChat();
        fetchSessions();
      } catch (err) { console.error(err); }
    }
  };

  useEffect(() => { 
    if (token) fetchSessions(); 
  }, [token, fetchSessions]);

  useEffect(() => {
    const savedId = localStorage.getItem('last_active_chat_id');
    if (savedId && sessions.length > 0 && messages.length === 0 && !activeChatId) {
      const sessionExists = sessions.some(s => s.id === savedId);
      if (sessionExists) {
        loadChat(savedId);
      }
    }
  }, [sessions, activeChatId, messages.length, loadChat]);

  return (
    <div className="flex h-full bg-[#050505] text-white font-sans overflow-hidden relative">
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-50 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 border border-white/5 transition-all shadow-2xl"
        >
          <PanelLeftOpen size={20} />
        </button>
      )}

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
                <span className="text-xs font-medium truncate">{s.title}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleDeleteChat(s.id, e)}
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

      <main className="flex-1 flex flex-col relative min-w-0 h-full overflow-hidden">
        <ChatContainer 
          messages={messages} 
          isThinking={isThinking} 
          thinkingStep={thinkingStep}
          onSessionCreated={fetchSessions}
        />
      </main>
    </div>
  );
}
