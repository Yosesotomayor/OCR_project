import { Link } from 'react-router-dom';
import { Zap, LogIn, UserPlus } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <div className="w-24 h-24 bg-[#0a0a0a] border border-[#1f1f1f] rounded-[32px] mx-auto mb-8 flex items-center justify-center shadow-2xl relative group">
          <div className="absolute inset-0 bg-accent-electric/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Zap className="w-12 h-12 text-accent-electric fill-accent-electric relative z-10" />
        </div>
        <h1 className="text-6xl font-black tracking-tighter mb-4">LeaseLens AI</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Inteligencia contractual potenciada por IA para la gestión de activos inmobiliarios.
          Optimiza tus operaciones, minimiza riesgos y maximiza el valor de tus contratos.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <Link
          to="/login"
          className="bg-accent-electric text-black px-8 py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-accent-electric/20 hover:scale-105 active:scale-95"
        >
          <LogIn size={24} />
          Iniciar Sesión
        </Link>
        <Link
          to="/register"
          className="bg-[#0a0a0a] border border-[#1f1f1f] text-gray-300 px-8 py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-3 transition-all hover:border-accent-electric/50 hover:text-accent-electric active:scale-95"
        >
          <UserPlus size={24} />
          Solicitar Acceso
        </Link>
      </div>

      <footer className="mt-20 text-gray-600 text-sm">
        © 2026 LeaseLens AI. Todos los derechos reservados.
      </footer>
    </div>
  );
}
