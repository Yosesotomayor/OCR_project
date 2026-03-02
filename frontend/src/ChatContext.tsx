import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ChatMessage } from './types';
import { useAuth } from './hooks/useAuth';

interface ChatContextType {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isThinking: boolean;
  thinkingStep: string;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  sendMessage: (text: string) => Promise<void>;
  loadChat: (chatId: string) => Promise<void>;
  startNewChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);
const API_URL = import.meta.env.VITE_API_URL;

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState('');
  const [activeChatId, setActiveChatId] = useState<string | null>(localStorage.getItem('last_active_chat_id'));
  const { token } = useAuth();

  // Persistencia automática de activeChatId
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('last_active_chat_id', activeChatId);
    } else {
      localStorage.removeItem('last_active_chat_id');
    }
  }, [activeChatId]);

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([]);
  }, []);

  const loadChat = useCallback(async (chatId: string) => {
    if (!token) return;
    setActiveChatId(chatId);
    setMessages([]); // Limpiar antes de cargar
    try {
      const res = await fetch(`${API_URL}/chats/${chatId}/messages`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) {
        const history = await res.json();
        setMessages(history.map((m: any) => ({
          id: m.id || Math.random().toString(),
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp).toLocaleTimeString()
        })));
      }
    } catch (err) { console.error(err); }
  }, [token]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !token || isThinking) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);
    setThinkingStep('Iniciando protocolos...');

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toLocaleTimeString() }]);

    try {
      const steps = ['Sincronizando con GPU...', 'Consultando Base de Vectores...', 'Analizando Portafolio...', 'Generando Reporte Legal...'];
      let stepIdx = 0;
      const stepInterval = setInterval(() => {
        if (stepIdx < steps.length) setThinkingStep(steps[stepIdx++]);
      }, 2000);

      const response = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ question: text, chat_id: activeChatId })
      });

      clearInterval(stepInterval);
      if (!response.ok) throw new Error("GPU Timeout");

      const newChatId = response.headers.get("X-Chat-ID");
      if (newChatId && newChatId !== activeChatId) {
        setActiveChatId(newChatId);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      if (reader) {
        setThinkingStep('Recibiendo datos...');
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulatedContent += decoder.decode(value, { stream: true });
          setMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: accumulatedContent } : msg));
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: "⚠️ Error de conexión. La IA está tardando demasiado en responder." } : msg));
    } finally {
      setIsThinking(false);
      setThinkingStep('');
    }
  };

  return (
    <ChatContext.Provider value={{ messages, setMessages, isThinking, thinkingStep, activeChatId, setActiveChatId, sendMessage, loadChat, startNewChat }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};
