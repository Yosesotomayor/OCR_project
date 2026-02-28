import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth'; // Import useAuth

const Subscription: React.FC = () => {
  const { user, updateUserSubscription } = useAuth(); // Get user and updateUserSubscription from useAuth
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const [loading, setLoading] = useState(false); // State for loading indicator

  const handleChoosePlan = async (planName: string) => {
    setLoading(true);
    try {
      await updateUserSubscription(planName, billingCycle);
      alert(`You have successfully chosen the ${planName} plan (${billingCycle}).`);
    } catch (error) {
      alert('Failed to update subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pricingPlans = [
    {
      name: 'Basic',
      monthlyPrice: 10,
      annuallyPrice: 100,
      features: ['Feature 1', 'Feature 2', 'Feature 3'],
    },
    {
      name: 'Pro',
      monthlyPrice: 25,
      annuallyPrice: 250,
      features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'],
    },
    {
      name: 'Enterprise',
      monthlyPrice: 50,
      annuallyPrice: 500,
      features: ['All Pro Features', 'Custom Integrations', 'Dedicated Support'],
    },
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Choose Your Plan</h1>

      {/* Billing Cycle Toggle */}
      <div className="flex justify-center mb-12">
        <div className="relative inline-flex items-center p-1 rounded-full bg-gray-200">
          <button
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
              billingCycle === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly
          </button>
          <button
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
              billingCycle === 'annually' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => setBillingCycle('annually')}
          >
            Annually
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {pricingPlans.map((plan) => (
          <div
            key={plan.name}
            className={`bg-white rounded-lg shadow-lg p-8 flex flex-col items-center text-center relative
            ${user?.subscription_plan === plan.name ? 'border-4 border-blue-500' : ''}`} // Highlight active plan
          >
            {user?.subscription_plan === plan.name && (
              <span className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                Current Plan
              </span>
            )}
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{plan.name}</h2>
            <p className="text-5xl font-extrabold text-gray-900 mb-6">
              ${billingCycle === 'monthly' ? plan.monthlyPrice : plan.annuallyPrice}
              <span className="text-xl font-medium text-gray-600">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
            </p>
            <ul className="text-gray-600 mb-8 space-y-2">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              className="mt-auto w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleChoosePlan(plan.name)}
              disabled={loading || user?.subscription_plan === plan.name} // Disable if loading or already current plan
            >
              {loading ? 'Processing...' : (user?.subscription_plan === plan.name ? 'Current Plan' : `Choose ${plan.name}`)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Subscription;
