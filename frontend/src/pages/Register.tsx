import { useState } from 'react';
import AuthLayout from '../layouts/AuthLayout';
import { ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils';
import { createUser } from '../client/sdk.gen';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setUsernameError('');

    if (!username.trim()) {
      setUsernameError('El nombre de usuario es obligatorio.');
      return;
    }

    if (!password) {
      setRegisterError('Por favor, ingresa tu contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await createUser({
        body: { username, password }
      });

      if (error) {
        setRegisterError((error as any).detail || 'Error al solicitar acceso');
        return;
      }

      if (data) {
        alert('Solicitud de acceso enviada. Ahora puedes iniciar sesión.');
        navigate('/login');
      }

    } catch (error) {
      console.error('Error de red o servidor:', error);
      setRegisterError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

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

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Nombre de Usuario</label>
          <input 
            type="text" 
            placeholder="USUARIO_ID"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={cn(
              "w-full bg-[#0a0a0a] border rounded-xl px-5 py-4 text-white focus:outline-none focus:border-accent-electric/50 focus:ring-1 focus:ring-accent-electric/20 transition-all placeholder:text-gray-800 text-sm font-bold tracking-tight uppercase",
              usernameError ? "border-red-500" : "border-[#1f1f1f]"
            )}
          />
          {usernameError && (
            <p className="text-red-500 text-xs flex items-center gap-1 ml-1">
              <AlertCircle size={12} /> {usernameError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Contraseña</label>
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
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

        {registerError && (
          <p className="text-red-500 text-sm text-center flex items-center justify-center gap-1">
            <AlertCircle size={16} /> {registerError}
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
          {isLoading ? 'Solicitando...' : 'Generar Licencia'}
        </button>

        <p className="text-center text-gray-700 text-[10px] mt-10 font-bold uppercase tracking-widest">
          ¿Ya tiene credenciales? <a href="/login" className="text-accent-electric/60 hover:text-accent-electric transition-colors">Iniciar Protocolo</a>
        </p>
      </form>
    </AuthLayout>
  );
}
