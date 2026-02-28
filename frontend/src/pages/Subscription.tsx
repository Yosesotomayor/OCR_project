import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { CheckCircle, Loader2 } from 'lucide-react'; // Import CheckCircle for features, Loader2 for loading

const Subscription: React.FC = () => {
  const { user, updateUserSubscription } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const [loading, setLoading] = useState(false);

  const handleChoosePlan = async (planName: string) => {
    setLoading(true);
    try {
      await updateUserSubscription(planName, billingCycle);
      // alert(`You have successfully chosen the ${planName} plan (${billingCycle}).`); // Replaced with more subtle feedback if needed
    } catch (error) {
      alert('Failed to update subscription. Please try again.');
    } finally {
      setLoading(false);
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
        <h1 className="text-4xl font-bold text-center mb-4 text-gray-100">Elige tu Plan</h1>
        <p className="text-lg text-center text-gray-400 mb-12">
          Encuentra el plan perfecto para tus necesidades de análisis de contratos.
        </p>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-16">
          <div className="relative inline-flex items-center p-1 rounded-full bg-[#1f1f1f] shadow-inner">
            <button
              className={`px-8 py-3 rounded-full text-sm font-semibold transition-all duration-300 ${
                billingCycle === 'monthly' 
                  ? 'bg-accent-electric text-black shadow-md' 
                  : 'text-gray-400 hover:text-gray-100'
              }`}
              onClick={() => setBillingCycle('monthly')}
            >
              Mensual
            </button>
            <button
              className={`px-8 py-3 rounded-full text-sm font-semibold transition-all duration-300 ${
                billingCycle === 'annually' 
                  ? 'bg-accent-electric text-black shadow-md' 
                  : 'text-gray-400 hover:text-gray-100'
              }`}
              onClick={() => setBillingCycle('annually')}
            >
              Anual (-17% de ahorro)
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-[#0a0a0a] rounded-2xl shadow-xl p-8 flex flex-col items-center text-center relative transition-all duration-300 hover:scale-[1.02]
              ${user?.subscription_plan === plan.name 
                ? 'border-4 border-accent-electric shadow-accent-electric/30' 
                : 'border border-[#1f1f1f]'}` // Highlight active plan
              }
            >
              {user?.subscription_plan === plan.name && (
                <span className="absolute top-0 right-0 bg-accent-electric text-black text-xs font-bold px-4 py-2 rounded-bl-xl">
                  Plan Actual
                </span>
              )}
              <h2 className="text-3xl font-bold text-gray-100 mb-4">{plan.name}</h2>
              <p className="text-6xl font-extrabold text-accent-electric mb-6">
                ${billingCycle === 'monthly' ? plan.monthlyPrice : plan.annuallyPrice}
                <span className="text-xl font-medium text-gray-400">/{billingCycle === 'monthly' ? 'mes' : 'año'}</span>
              </p>
              <ul className="text-gray-300 mb-10 space-y-3 text-left w-full">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                className="mt-auto w-full bg-accent-electric hover:bg-accent-electric/90 text-black font-bold py-4 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                onClick={() => handleChoosePlan(plan.name)}
                disabled={loading || user?.subscription_plan === plan.name}
              >
                {loading && user?.subscription_plan !== plan.name ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : user?.subscription_plan === plan.name ? (
                  'Plan Actual'
                ) : (
                  `Elegir Plan ${plan.name}`
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Subscription;
