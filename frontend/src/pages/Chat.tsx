import ChatContainer from '../components/ChatContainer';

export default function Chat() {
  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/5 to-transparent pointer-events-none" />
      <div className="p-8 border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Asistente Inteligente</h1>
            <p className="text-gray-400 text-xs mt-1">Conversa con tu base de conocimientos privada con tecnología RAG</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">IA Conectada</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <ChatContainer />
      </div>
    </div>
  );
}
