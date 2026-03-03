import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { CheckCircle, Loader2, Users, Shield, CreditCard } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const Subscription: React.FC = () => {
  const { user, token, isAdmin, updateUserSubscription } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    if (isAdmin && token) {
      fetchUsers();
    }
  }, [isAdmin, token]);

  const fetchUsers = async () => {
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users", err);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleUpdateUserPlan = async (userId: string, planName: string) => {
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/subscription`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ subscription_plan: planName })
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      alert("Error actualizando suscripción");
    } finally {
      setAdminLoading(false);
    }
  };

  const handlePersonalSubscription = async (planName: string) => {
    setLoading(planName);
    try {
      await updateUserSubscription(planName, billingCycle);
    } catch (error) {
      console.error(error);
      alert('Error al actualizar tu suscripción.');
    } finally {
      setLoading(null);
    }
  };

  const pricingPlans = [
    {
      name: 'Básico',
      monthlyPrice: 10,
      annuallyPrice: 100,
      features: ['Acceso a Chat AI', '500 mensajes/mes', 'Soporte estándar'],
    },
    {
      name: 'Pro',
      monthlyPrice: 25,
      annuallyPrice: 250,
      features: ['Acceso a Chat AI', 'Mensajes ilimitados', 'Carga de documentos', 'Soporte prioritario', 'Historial de chat'],
    },
    {
      name: 'Empresarial',
      monthlyPrice: 50,
      annuallyPrice: 500,
      features: ['Todas las características Pro', 'Integraciones personalizadas', 'Soporte dedicado 24/7', 'Análisis avanzado de documentos', 'Gestión de equipos'],
    },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6">
      <div className="max-w-6xl mx-auto py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 border-b border-[#1f1f1f] pb-8 gap-6">
          <div>
            <h1 className="text-4xl font-black text-gray-100 mb-2 tracking-tight">Suscripciones</h1>
            <p className="text-gray-400 font-medium">Gestión de planes y accesos inteligentes.</p>
          </div>
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] p-5 rounded-2xl flex items-center gap-4 shadow-2xl">
             <div className="bg-accent-electric/10 p-3 rounded-xl">
                <Shield className="w-6 h-6 text-accent-electric" />
             </div>
             <div>
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Estado de Cuenta</p>
                <p className="text-sm font-bold text-white uppercase tracking-tighter">
                    {user?.subscription_plan || 'FREE'} {isAdmin ? '(Administrator)' : ''}
                </p>
             </div>
          </div>
        </div>

        {/* --- SECCIÓN ADMIN: GESTIÓN DE USUARIOS --- */}
        {isAdmin && (
          <div className="mb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-accent-electric/10 rounded-lg">
                <Users className="w-6 h-6 text-accent-electric" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Consola de Administración de Usuarios</h2>
            </div>
            
            <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-[24px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                    <tr className="bg-[#0f0f0f] border-b border-[#1f1f1f]">
                        <th className="p-6 text-[10px] font-black uppercase text-gray-500 tracking-widest">Identidad</th>
                        <th className="p-6 text-[10px] font-black uppercase text-gray-500 tracking-widest">Nivel de Acceso</th>
                        <th className="p-6 text-[10px] font-black uppercase text-gray-500 tracking-widest text-center">Modificar Protocolo</th>
                    </tr>
                    </thead>
                    <tbody>
                    {allUsers.map((u) => (
                        <tr key={u.id} className="border-b border-[#1f1f1f] hover:bg-[#0c0c0c] transition-colors group">
                        <td className="p-6">
                            <p className="font-bold text-gray-200 group-hover:text-accent-electric transition-colors">{u.email}</p>
                            <p className="text-[10px] text-gray-600 font-mono mt-1 uppercase">{u.id}</p>
                        </td>
                        <td className="p-6">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            u.subscription_plan === 'Empresarial' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                            u.subscription_plan === 'Pro' ? 'bg-accent-electric/10 text-accent-electric border border-accent-electric/20' :
                            u.subscription_plan === 'Básico' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            'bg-gray-900 text-gray-500 border border-gray-800'
                            }`}>
                            {u.subscription_plan || 'STANDBY'}
                            </span>
                        </td>
                        <td className="p-6">
                            <div className="flex justify-center gap-2">
                            {['Básico', 'Pro', 'Empresarial'].map(plan => (
                                <button
                                key={plan}
                                onClick={() => handleUpdateUserPlan(u.id, plan)}
                                disabled={adminLoading}
                                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border transition-all ${
                                    u.subscription_plan === plan 
                                    ? 'bg-white text-black border-white shadow-lg' 
                                    : 'border-[#1f1f1f] text-gray-600 hover:border-accent-electric hover:text-accent-electric hover:bg-accent-electric/5'
                                }`}
                                >
                                {plan}
                                </button>
                            ))}
                            </div>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
              </div>
              {adminLoading && (
                <div className="p-12 flex flex-col items-center gap-4 bg-[#0a0a0a]/80 backdrop-blur-sm border-t border-[#1f1f1f]">
                  <Loader2 className="animate-spin text-accent-electric w-10 h-10" />
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Sincronizando Base de Datos...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- SECCIÓN PERSONAL: TARJETAS --- */}
        <div className="mb-20">
            <div className="flex items-center gap-3 mb-10">
              <div className="p-2 bg-accent-electric/10 rounded-lg">
                <CreditCard className="w-6 h-6 text-accent-electric" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Protocolo de Suscripción Personal</h2>
            </div>

            {/* Selector de Ciclo */}
            <div className="flex justify-center mb-16">
              <div className="relative inline-flex items-center p-1.5 rounded-2xl bg-[#111111] border border-[#1f1f1f] shadow-inner">
                <button
                  className={`px-10 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-500 ${
                    billingCycle === 'monthly' 
                      ? 'bg-accent-electric text-black shadow-[0_0_20px_rgba(168,85,247,0.4)]' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  onClick={() => setBillingCycle('monthly')}
                >
                  Mensual
                </button>
                <button
                  className={`px-10 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-500 ${
                    billingCycle === 'annually' 
                      ? 'bg-accent-electric text-black shadow-[0_0_20px_rgba(168,85,247,0.4)]' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  onClick={() => setBillingCycle('annually')}
                >
                  Anual (-17%)
                </button>
              </div>
            </div>

            {/* Grid de Tarjetas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`bg-[#0a0a0a] rounded-[32px] p-10 flex flex-col border transition-all duration-500 group relative ${
                    user?.subscription_plan === plan.name 
                    ? 'border-accent-electric shadow-[0_0_50px_rgba(168,85,247,0.15)] bg-gradient-to-b from-accent-electric/5 to-transparent' 
                    : 'border-[#1f1f1f] hover:border-accent-electric/40 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:-translate-y-2'
                  }`}
                >
                  {user?.subscription_plan === plan.name && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent-electric text-black text-[10px] font-black px-6 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(168,85,247,0.5)] z-20">
                      Nivel Activo
                    </div>
                  )}
                  
                  <div className="mb-10 text-center">
                    <h2 className="text-xl font-black text-gray-400 uppercase tracking-[0.3em] mb-4 group-hover:text-white transition-colors">
                        {plan.name}
                    </h2>
                    <div className="flex items-baseline justify-center gap-1">
                        <span className="text-2xl font-black text-gray-500">$</span>
                        <span className="text-6xl font-black text-white tracking-tighter">
                            {billingCycle === 'monthly' ? plan.monthlyPrice : plan.annuallyPrice}
                        </span>
                        <span className="text-xs font-black text-gray-600 uppercase tracking-widest ml-1">
                            /{billingCycle === 'monthly' ? 'Mes' : 'Año'}
                        </span>
                    </div>
                  </div>

                  <ul className="text-gray-500 mb-12 space-y-5 text-sm font-medium flex-grow border-t border-[#1f1f1f] pt-10">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-4 group/item">
                        <div className="mt-1 bg-accent-electric/20 p-1 rounded-md group-hover/item:bg-accent-electric/40 transition-colors">
                            <CheckCircle className="w-3.5 h-3.5 text-accent-electric" />
                        </div>
                        <span className="group-hover/item:text-gray-300 transition-colors leading-tight">
                            {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handlePersonalSubscription(plan.name)}
                    disabled={!!loading || user?.subscription_plan === plan.name}
                    className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${
                        user?.subscription_plan === plan.name
                        ? 'bg-[#111111] text-gray-700 border border-[#1f1f1f] cursor-default'
                        : 'bg-accent-electric text-black shadow-[0_10px_30px_rgba(168,85,247,0.3)] hover:shadow-[0_15px_40px_rgba(168,85,247,0.5)]'
                    }`}
                  >
                    {loading === plan.name ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : user?.subscription_plan === plan.name ? (
                      'Protocolo Activo'
                    ) : (
                      `Activar ${plan.name}`
                    )}
                  </button>
                </div>
              ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
