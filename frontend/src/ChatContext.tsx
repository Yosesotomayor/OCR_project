import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ChatMessage } from './types';
import { useAuth } from './hooks/useAuth';
import { createChat, getMessages, sendMessage as sdkSendMessage } from './client/sdk.gen';
import { client } from './api/client';

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

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState('');
  const [activeChatId, setActiveChatId] = useState<string | null>(localStorage.getItem('last_active_chat_id'));
  const { token } = useAuth();

  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('last_active_chat_id', activeChatId);
    } else {
      localStorage.removeItem('last_active_chat_id');
    }
  }, [activeChatId]);

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
    localStorage.removeItem('last_active_chat_id');
    setMessages([]);
  }, []);

  const loadChat = useCallback(async (chatId: string) => {
    if (!token) return;
    setActiveChatId(chatId);
    setMessages([]);
    try {
      const { data, error } = await getMessages({ path: { chat_id: chatId } });
      if (error) {
        console.error("Chat not found, starting new chat");
        startNewChat();
        return;
      }
      if (data) {
        setMessages(data.map((m: any) => ({
          id: m.id || Math.random().toString(),
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at).toLocaleTimeString()
        })));
      }
    } catch (err) { 
      console.error(err);
      startNewChat();
    }
  }, [token, startNewChat]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !token || isThinking) return;
  
    let currentChatId = activeChatId;
  
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };
  
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);
    setThinkingStep("Iniciando protocolos...");
  
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date().toLocaleTimeString() }
    ]);
  
    try {
      // STEP 1: Create chat if needed
      if (!currentChatId) {
        setThinkingStep("Creando nueva sesión...");
  
        const { data: newChat } = await createChat({
          body: { content: text }
        });
  
        if (!newChat) throw new Error("Failed to create chat");
  
        currentChatId = newChat.id;
        setActiveChatId(currentChatId);
      }
  
      // STEP 2: Thinking steps animation
      const steps = [
        "Sincronizando con GPU...",
        "Consultando Base de Vectores...",
        "Analizando Portafolio...",
        "Generando Reporte Legal..."
      ];
  
      let stepIdx = 0;
      const stepInterval = setInterval(() => {
        if (stepIdx < steps.length) setThinkingStep(steps[stepIdx++]);
      }, 2000);
  
      // STEP 3: Call SDK endpoint
      const { response } = await sdkSendMessage({
        path: { chat_id: currentChatId },
        body: { query: text },
        parseAs: 'stream'
      });
  
      console.log("Response:", response);
      
      if (response.status === 404) {
        setActiveChatId(null);
        localStorage.removeItem('last_active_chat_id');
        throw new Error("La sesión ya no existe. Por favor, intenta de nuevo.");
      }

      if (!response.ok) throw new Error("GPU Timeout");
      if (!response.body) throw new Error("No stream");
  
      console.log("Body:", response.body);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
  
      let buffer = "";
      let accumulatedContent = "";
  
      setThinkingStep("Recibiendo datos...");
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        buffer += decoder.decode(value, { stream: true });
  
        // Split SSE events
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
  
        for (const eventStr of events) {
          const lines = eventStr.split("\n");
  
          let eventType = "message";
          let dataStr = "";
  
          for (const line of lines) {
            if (line.startsWith("event:"))
              eventType = line.replace("event:", "").trim();
  
            if (line.startsWith("data:"))
              dataStr += line.replace("data:", "").trim();
          }
  
          if (!dataStr) continue;
  
          const parsed = JSON.parse(dataStr);
  
          if (eventType === "token") {
            accumulatedContent += parsed.token;
  
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
          }
  
          if (eventType === "sources") {
            console.log("Sources:", parsed);
          }
  
          if (eventType === "done") {
            clearInterval(stepInterval);
          }
        }
      }
  
    } catch (err) {
      console.error(err);
  
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantId
            ? {
                ...msg,
                content: "⚠️ Error de conexión. La IA está tardando demasiado en responder."
              }
            : msg
        )
      );
    } finally {
      setIsThinking(false);
      setThinkingStep("");
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
