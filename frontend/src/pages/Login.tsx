import { useState } from 'react';
import AuthLayout from '../layouts/AuthLayout';
import { Zap, ShieldCheck, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

const API_URL = import.meta.env.VITE_API_URL;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (inputEmail: string) => {
    if (!inputEmail.endsWith('@vertiche.mx')) {
      setEmailError('El correo debe ser de dominio @vertiche.mx');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setEmailError('');

    if (!validateEmail(email)) {
      return;
    }

    if (!password) {
      setLoginError('Por favor, ingresa tu contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch(`${API_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setLoginError(errorData.detail || 'Error de autenticación');
        return;
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      navigate('/dashboard'); // Redirect to dashboard on successful login

    } catch (error) {
      console.error('Error de red o servidor:', error);
      setLoginError('No se pudo conectar con el servidor. Intenta de nuevo.');
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
        <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] mb-4">Enterprise Intelligence</p>
        <div className="flex items-center justify-center gap-2 text-[10px] text-accent-electric/60 font-medium">
          <ShieldCheck size={12} />
          Acceso Biométrico & Cifrado de Punto a Punto
        </div>
      </div>
      
      <form className="space-y-8" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Protocolo de Identidad</label>
          <input 
            type="email" 
            placeholder="USUARIO@VERTICHE.MX"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              validateEmail(e.target.value);
            }}
            onBlur={(e) => validateEmail(e.target.value)}
            className={cn(
              "w-full bg-[#0a0a0a] border rounded-xl px-5 py-4 text-white focus:outline-none focus:border-accent-electric/50 focus:ring-1 focus:ring-accent-electric/20 transition-all placeholder:text-gray-800 text-sm font-bold tracking-tight uppercase",
              emailError ? "border-red-500" : "border-[#1f1f1f]"
            )}
          />
          {emailError && (
            <p className="text-red-500 text-xs flex items-center gap-1 ml-1">
              <AlertCircle size={12} /> {emailError}
            </p>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center ml-1">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Código de Acceso</label>
            <a href="#" className="text-[9px] text-accent-electric/50 hover:text-accent-electric transition-colors uppercase font-black">Recuperar</a>
          </div>
          <input 
            type="password" 
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-5 py-4 text-white focus:outline-none focus:border-accent-electric/50 focus:ring-1 focus:ring-accent-electric/20 transition-all placeholder:text-gray-800 text-sm"
          />
        </div>
        
        {loginError && (
          <p className="text-red-500 text-sm text-center flex items-center justify-center gap-1">
            <AlertCircle size={16} /> {loginError}
          </p>
        )}

        <button 
          type="submit"
          disabled={isLoading}
          className={cn(
            "w-full bg-accent-electric hover:bg-accent-electric-hover text-black font-black py-5 rounded-xl mt-6 transition-all shadow-[0_0_30px_rgba(168,85,247,0.2)] active:scale-[0.98] uppercase tracking-[0.2em] text-xs",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isLoading ? 'Autenticando...' : 'Autenticar Sesión'}
        </button>
        
        <p className="text-center text-gray-700 text-[10px] mt-10 font-bold uppercase tracking-widest">
          ¿Sin credenciales? <a href="/register" className="text-accent-electric/60 hover:text-accent-electric transition-colors">Solicitar Acceso</a>
        </p>
      </form>
    </AuthLayout>
  );
}
