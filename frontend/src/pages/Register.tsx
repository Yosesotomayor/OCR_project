import AuthLayout from '../layouts/AuthLayout';
import { ShieldCheck } from 'lucide-react';

export default function Register() {
  return (
    <AuthLayout>
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">Solicitar Acceso</h2>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] mb-4">Nueva Licencia Enterprise</p>
        <div className="flex items-center justify-center gap-2 text-[10px] text-accent-electric/60 font-medium">
          <ShieldCheck size={12} />
          Verificación de Identidad Requerida
        </div>
      </div>

      <form className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Nombre del Operador</label>
          <input 
            type="text" 
            placeholder="NOMBRE COMPLETO"
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-5 py-4 text-white focus:outline-none focus:border-accent-electric/50 focus:ring-1 focus:ring-accent-electric/20 transition-all placeholder:text-gray-800 text-sm font-bold tracking-tight uppercase"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Email Corporativo</label>
          <input 
            type="email" 
            placeholder="EMAIL@LEASELENS.AI"
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-5 py-4 text-white focus:outline-none focus:border-accent-electric/50 focus:ring-1 focus:ring-accent-electric/20 transition-all placeholder:text-gray-800 text-sm font-bold tracking-tight uppercase"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Código de Acceso</label>
          <input 
            type="password" 
            placeholder="••••••••••••"
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-5 py-4 text-white focus:outline-none focus:border-accent-electric/50 focus:ring-1 focus:ring-accent-electric/20 transition-all placeholder:text-gray-800 text-sm"
          />
        </div>

        <button className="w-full bg-accent-electric hover:bg-accent-electric-hover text-white font-black py-5 rounded-xl mt-6 transition-all shadow-[0_0_30px_rgba(168,85,247,0.2)] active:scale-[0.98] uppercase tracking-[0.2em] text-xs">
          Generar Licencia
        </button>

        <p className="text-center text-gray-700 text-[10px] mt-10 font-bold uppercase tracking-widest">
          ¿Ya tiene credenciales? <a href="/login" className="text-accent-electric/60 hover:text-accent-electric transition-colors">Iniciar Protocolo</a>
        </p>
      </form>
    </AuthLayout>
  );
}
