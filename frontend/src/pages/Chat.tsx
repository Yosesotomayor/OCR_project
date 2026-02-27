import ChatContainer from '../components/ChatContainer';

export default function Chat() {
  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-[#050505]">
      {/* Efecto de luz ambiental en el fondo */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent-electric/5 to-transparent pointer-events-none" />
      
      <div className="p-8 border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Asistente Inteligente</h1>
            <p className="text-gray-400 text-xs mt-1 font-medium">
              Conversa con tu base de conocimientos privada con tecnología RAG
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-full">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
              RTX 4060 Active
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <ChatContainer />
      </div>
    </div>
  );
}