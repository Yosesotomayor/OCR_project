import { cn } from '../lib/utils';
import { IKPIs } from '../types';
import { TrendingUp, AlertCircle, ShieldCheck, PieChart, Calendar } from 'lucide-react';

export default function Dashboard() {
  const kpis: IKPIs = {
    total_mrr: 125400,
    active_leases: 48,
    pending_renewals: 12,
    vacancy_rate: 4.2,
    doc_health: 98.5,
    expiring_soon: 5
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="p-10 space-y-10">
      <header>
        <h1 className="text-4xl font-black tracking-tighter mb-2">Panel de Inteligencia</h1>
        <p className="text-gray-500 text-sm">Estado real de tu portafolio de activos inmobiliarios.</p>
      </header>

      {/* Real Estate KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { 
            label: 'MRR Total', 
            value: formatCurrency(kpis.total_mrr), 
            detail: '+4.5% vs mes anterior', 
            icon: TrendingUp,
            color: 'text-accent-electric'
          },
          { 
            label: 'Vencimientos <30d', 
            value: kpis.expiring_soon, 
            detail: 'Requiere atención inmediata', 
            icon: Calendar,
            color: 'text-orange-500'
          },
          { 
            label: 'Salud Documental', 
            value: `${kpis.doc_health}%`, 
            detail: 'RAG Indexing Status', 
            icon: ShieldCheck,
            color: 'text-emerald-500'
          },
          { 
            label: 'Tasa de Vacancia', 
            value: `${kpis.vacancy_rate}%`, 
            detail: 'Promedio portafolio', 
            icon: PieChart,
            color: 'text-blue-500'
          },
        ].map((kpi, i) => (
          <div key={i} className="bg-[#0a0a0a] border border-[#1f1f1f] p-6 rounded-xl hover:border-accent-electric/30 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{kpi.label}</p>
              <kpi.icon className={cn("w-4 h-4", kpi.color)} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-1 group-hover:translate-x-1 transition-transform">{kpi.value}</h2>
            <p className="text-[10px] text-gray-600 font-medium">{kpi.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lease Expiration Timeline Placeholder */}
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] p-8 rounded-2xl">
          <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-accent-electric" />
            Timeline de Vencimientos
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 p-3 border-l-2 border-accent-electric/20 bg-white/2 rounded-r-lg">
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-200">Local Comercial ID-40{i}</p>
                  <p className="text-[10px] text-gray-500">Vence en {i * 8} días • Tenant: Global Logistics S.A.</p>
                </div>
                <div className="text-xs font-mono text-accent-electric font-bold">$4,500/mo</div>
              </div>
            ))}
          </div>
        </div>

        {/* Document Analytics */}
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] p-8 rounded-2xl flex flex-col justify-center items-center text-center">
          <div className="w-24 h-24 rounded-full border-4 border-[#1f1f1f] border-t-accent-electric flex items-center justify-center mb-4">
            <span className="text-xl font-bold">{kpis.doc_health}%</span>
          </div>
          <h3 className="text-sm font-bold mb-1 italic">Document Health Score</h3>
          <p className="text-xs text-gray-500 max-w-[200px]">Precisión de indexación y extracción de datos contractuales.</p>
        </div>
      </div>
    </div>
  );
}
