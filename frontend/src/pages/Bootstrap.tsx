import { useState } from 'react';
import AuthLayout from '../layouts/AuthLayout';
import { ShieldCheck, AlertCircle, Eye, EyeOff, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils';
import { useAuth } from '../hooks/useAuth';

export default function Bootstrap() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { bootstrap } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Todos los campos son obligatorios.');
      return;
    }

    setIsLoading(true);
    try {
      await bootstrap(username, password);
      alert('Sistema inicializado con éxito. Ahora puedes iniciar sesión con tu cuenta de administrador.');
      navigate('/login');
    } catch (err: any) {
      console.error(err);
      setError(err.detail || 'Error al inicializar el sistema.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="text-center mb-12">
        <div className="w-20 h-20 bg-[#0a0a0a] border border-[#1f1f1f] rounded-[24px] mx-auto mb-8 flex items-center justify-center shadow-2xl relative group">
          <div className="absolute inset-0 bg-accent-electric/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Zap className="w-10 h-10 text-accent-electric fill-accent-electric relative z-10" />
        </div>
        <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">LeaseLens AI</h2>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] mb-4">Configuración del Sistema</p>
        <div className="flex items-center justify-center gap-2 text-[10px] text-accent-electric/60 font-medium">
          <ShieldCheck size={12} />
          Creación de Administrador Global
        </div>
      </div>

      <form className="space-y-8" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <input 
            type="text" 
            placeholder="usuario administrador"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-5 py-4 text-white focus:outline-none focus:border-accent-electric/50 focus:ring-1 focus:ring-accent-electric/20 transition-all placeholder:text-gray-800 text-sm font-bold tracking-tight"
          />
        </div>

        <div className="space-y-2">
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'}
              placeholder="contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-5 py-4 text-white focus:outline-none focus:border-accent-electric/50 focus:ring-1 focus:ring-accent-electric/20 transition-all placeholder:text-gray-800 text-sm pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center flex items-center justify-center gap-1">
            <AlertCircle size={16} /> {error}
          </p>
        )}

        <button 
          type="submit"
          disabled={isLoading}
          className={cn(
            "w-full bg-accent-electric hover:bg-accent-electric/90 text-black font-black py-5 rounded-xl mt-6 transition-all shadow-[0_0_30px_rgba(0,240,255,0.2)] active:scale-[0.98] uppercase tracking-[0.2em] text-xs",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isLoading ? 'Configurando...' : 'Activar Sistema'}
        </button>
      </form>
    </AuthLayout>
  );
}
