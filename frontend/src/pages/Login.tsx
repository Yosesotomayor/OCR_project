import AuthLayout from '../layouts/AuthLayout';
import { Zap, ShieldCheck } from 'lucide-react';

export default function Login() {
  return (
    <AuthLayout>
      <div className="text-center mb-12">
        <div className="w-20 h-20 bg-[#0a0a0a] border border-[#1f1f1f] rounded-[24px] mx-auto mb-8 flex items-center justify-center shadow-2xl relative group">
          <div className="absolute inset-0 bg-accent-electric/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Zap className="w-10 h-10 text-accent-electric fill-accent-electric relative z-10" />
        </div>
        <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">LeaseLens AI</h2>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] mb-4">Enterprise Intelligence</p>
        <div className="flex items-center justify-center gap-2 text-[10px] text-accent-electric/60 font-medium">
          <ShieldCheck size={12} />
          Acceso Biométrico & Cifrado de Punto a Punto
        </div>
      </div>
      
      <form className="space-y-8">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Protocolo de Identidad</label>
          <input 
            type="email" 
            placeholder="USUARIO@LEASELENS.AI"
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-5 py-4 text-white focus:outline-none focus:border-accent-electric/50 focus:ring-1 focus:ring-accent-electric/20 transition-all placeholder:text-gray-800 text-sm font-bold tracking-tight uppercase"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center ml-1">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Código de Acceso</label>
            <a href="#" className="text-[9px] text-accent-electric/50 hover:text-accent-electric transition-colors uppercase font-black">Recuperar</a>
          </div>
          <input 
            type="password" 
            placeholder="••••••••••••"
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-5 py-4 text-white focus:outline-none focus:border-accent-electric/50 focus:ring-1 focus:ring-accent-electric/20 transition-all placeholder:text-gray-800 text-sm"
          />
        </div>
        
        <button className="w-full bg-accent-electric hover:bg-accent-electric-hover text-white font-black py-5 rounded-xl mt-6 transition-all shadow-[0_0_30px_rgba(168,85,247,0.2)] active:scale-[0.98] uppercase tracking-[0.2em] text-xs">
          Autenticar Sesión
        </button>
        
        <p className="text-center text-gray-700 text-[10px] mt-10 font-bold uppercase tracking-widest">
          ¿Sin credenciales? <a href="/register" className="text-accent-electric/60 hover:text-accent-electric transition-colors">Solicitar Acceso</a>
        </p>
      </form>
    </AuthLayout>
  );
}
