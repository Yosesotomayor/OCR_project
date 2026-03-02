import { useState, useEffect, useMemo } from 'react';
import { cn } from '../lib/utils';
import { ILeaseContract } from '../types';
import { 
  TrendingUp, ShieldCheck, Calendar, Loader2, Download, 
  FileText, X, Eye, MapPin, Building, DollarSign, 
  ArrowUpRight, Users, Briefcase, Activity
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart as RePieChart, Pie, LineChart, Line, AreaChart, Area
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL;

const COLORS = ['#00F0FF', '#7000FF', '#FF00E5', '#33FF00', '#FFB800'];

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [contracts, setContracts] = useState<ILeaseContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<ILeaseContract | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpiRes, contractRes] = await Promise.all([
          fetch(`${API_URL}/analytics/summary`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_URL}/contracts`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        if (kpiRes.ok) setData(await kpiRes.json());
        if (contractRes.ok) setContracts(await contractRes.json());
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    if (token) fetchData();
  }, [token]);

  const openPreview = async (contract: ILeaseContract) => {
    setSelectedContract(contract);
    setPreviewUrl(null);
    try {
      const res = await fetch(`${API_URL}/contracts/${contract.id}/presigned_url`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPreviewUrl(data.presigned_url);
    } catch (error) { console.error(error); }
  };

  const handleDownload = async (contractId: string, filename: string) => {
    try {
      const res = await fetch(`${API_URL}/contracts/${contractId}/presigned_url`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const a = document.createElement('a'); a.href = data.presigned_url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (error) { console.error(error); }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-accent-electric w-12 h-12" /></div>;

  return (
    <div className="p-10 space-y-10 font-sans h-full overflow-y-auto bg-[#050505] text-white selection:bg-accent-electric/30">
      <header className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-5xl font-black tracking-tighter italic">Intelligence Hub</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-[0.2em]">Monitoreo de Activos y Riesgo Contractual</p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sistema Sincronizado</span>
        </div>
      </header>

      {/* KPIs Estratégicos con Estilo Premium */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'MRR Portafolio', value: formatCurrency(data?.total_mrr || 0), icon: TrendingUp, trend: '+12.5%', color: 'text-accent-electric', bg: 'bg-accent-electric/5' },
          { label: 'Riesgo Expiración', value: data?.upcoming_expirations || 0, icon: Calendar, trend: 'Próx. 30 días', color: 'text-orange-500', bg: 'bg-orange-500/5' },
          { label: 'Salud Documental', value: `${data?.compliance_score || 0}%`, icon: ShieldCheck, trend: 'Auditado IA', color: 'text-emerald-500', bg: 'bg-emerald-500/5' },
          { label: 'Capacidad Activa', value: data?.active_contracts || 0, icon: Users, trend: 'Contratos', color: 'text-blue-500', bg: 'bg-blue-500/5' },
        ].map((kpi, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            key={i} className="relative group bg-[#0a0a0a] border border-white/5 p-8 rounded-[2rem] overflow-hidden transition-all hover:border-accent-electric/40 shadow-2xl"
          >
            <div className={cn("absolute top-0 right-0 w-32 h-32 blur-[80px] -mr-16 -mt-16 opacity-20", kpi.color.replace('text', 'bg'))} />
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <div className={cn("p-3 rounded-xl", kpi.bg)}><kpi.icon className={cn("w-5 h-5", kpi.color)} /></div>
                <span className={cn("text-[10px] font-black px-2 py-1 rounded-md bg-white/5", kpi.color)}>{kpi.trend}</span>
              </div>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{kpi.label}</p>
              <h2 className="text-3xl font-black tracking-tight">{kpi.value}</h2>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Gráficas de Data Science */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue by Zone - Pie Chart */}
        <div className="bg-[#0a0a0a] border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Distribución de Ingresos por Zona</h3>
            <div className="p-2 bg-white/5 rounded-lg"><Building size={16} className="text-accent-electric"/></div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={data?.revenue_by_zone || []}
                  cx="50%" cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(data?.revenue_by_zone || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            {(data?.revenue_by_zone || []).map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[10px] font-bold text-gray-500 uppercase">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expiration Timeline - Bar Chart */}
        <div className="bg-[#0a0a0a] border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Pipeline de Vencimientos (12m)</h3>
            <div className="p-2 bg-white/5 rounded-lg"><Activity size={16} className="text-orange-500"/></div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.expirations_timeline || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                />
                <Bar dataKey="count" fill="#7000FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] text-gray-600 text-center italic uppercase tracking-widest">Crucial para la planificación de renovaciones y reducción de churn.</p>
        </div>
      </div>

      {/* Tabla de Gestión Avanzada */}
      <div className="space-y-6">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400 px-4">Monitoreo de Activos Recientes</h3>
        <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all hover:border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-white/2 text-gray-500 font-bold uppercase tracking-[0.2em] border-b border-white/5">
                <tr>
                  <th className="px-8 py-6">Arrendatario / Activo</th>
                  <th className="px-8 py-6">Renta Mensual</th>
                  <th className="px-8 py-6">Timeline</th>
                  <th className="px-8 py-6">Análisis IA</th>
                  <th className="px-8 py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {contracts.slice(0, 5).map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-accent-electric transition-colors border border-white/5">
                          <Building size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-200 text-sm tracking-tight">{c.tenant_name || c.filename}</p>
                          <p className="text-[9px] text-gray-600 flex items-center gap-1 uppercase tracking-widest mt-0.5">
                            <MapPin size={10} className="text-accent-electric" /> {c.property_zone || 'Zona no especificada'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 font-mono text-accent-electric font-black text-sm">
                      {c.monthly_rent ? formatCurrency(c.monthly_rent) : '---'}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-400 font-mono text-[10px]">{c.expiry_date || 'S/I'}</span>
                        <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 w-[60%] opacity-50" /> {/* Simulación de tiempo transcurrido */}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.15em] border shadow-sm",
                        c.status === 'completed' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        c.status === 'error' ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_0_10px_rgba(0,240,255,0.1)]"
                      )}>
                        {c.status === 'completed' ? <ShieldCheck size={10}/> : <Activity size={10} className="animate-spin"/>}
                        {c.status}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <button onClick={() => openPreview(c)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all border border-white/10"><Eye size={16} /></button>
                        <button onClick={() => handleDownload(c.id, c.filename)} className="p-3 bg-accent-electric/10 hover:bg-accent-electric text-black rounded-xl transition-all shadow-[0_0_20px_rgba(0,240,255,0.2)]"><Download size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedContract && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0a0a0a] border border-white/10 w-full max-w-7xl h-[92vh] rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,240,255,0.15)] flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#0d0d0d]">
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-accent-electric text-black rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.3)]"><FileText size={24}/></div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tighter italic">{selectedContract.filename}</h3>
                    <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em]">Protocolo de Análisis: Secure_View_v4</p>
                  </div>
                </div>
                <button onClick={() => {setSelectedContract(null); setPreviewUrl(null);}} className="p-4 hover:bg-white/5 rounded-full transition-all text-gray-500 hover:text-white border border-transparent hover:border-white/10"><X size={28}/></button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                <div className="flex-[2.5] bg-[#020202] p-8 relative">
                   {previewUrl ? (
                    <embed src={previewUrl} type="application/pdf" className="w-full h-full rounded-2xl border border-white/5 shadow-2xl" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700 gap-6">
                      <div className="relative">
                        <Loader2 className="animate-spin text-accent-electric w-16 h-16"/>
                        <Zap className="absolute inset-0 m-auto text-accent-electric w-6 h-6 animate-pulse"/>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Sincronizando Túnel SSL S3...</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 bg-[#0a0a0a] border-l border-white/5 p-12 space-y-12 overflow-y-auto">
                  <section className="space-y-8">
                    <div className="flex items-center gap-3 text-accent-electric">
                      <ShieldCheck size={20}/>
                      <h4 className="text-xs font-black uppercase tracking-[0.4em]">Análisis Estructurado</h4>
                    </div>
                    
                    <div className="grid gap-4">
                      {[
                        { label: 'Arrendatario', value: selectedContract.tenant_name || 'No detectado', icon: Users },
                        { label: 'Renta Mensual', value: selectedContract.monthly_rent ? `${formatCurrency(selectedContract.monthly_rent)} ${selectedContract.currency || 'MXN'}` : '---', icon: DollarSign, highlight: true },
                        { label: 'Propiedad', value: selectedContract.property_name || '---', icon: Building },
                        { label: 'Zona Geográfica', value: selectedContract.property_zone || '---', icon: MapPin },
                        { label: 'Vencimiento', value: selectedContract.expiry_date || 'No especificado', icon: Calendar },
                      ].map((item, idx) => (
                        <div key={idx} className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl group hover:bg-white/[0.05] transition-all">
                          <p className="text-[9px] text-gray-600 uppercase font-black tracking-widest mb-2 flex items-center gap-2">
                            <item.icon size={12}/> {item.label}
                          </p>
                          <p className={cn("text-lg font-bold tracking-tight", item.highlight ? "text-accent-electric" : "text-gray-200")}>
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="pt-4">
                    <button 
                      onClick={() => handleDownload(selectedContract.id, selectedContract.filename)}
                      className="w-full bg-accent-electric text-black py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-white transition-all shadow-[0_20px_40px_rgba(0,240,255,0.2)] group"
                    >
                      <Download size={20} className="group-hover:bounce" /> Exportar Documentación
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
