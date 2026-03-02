import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { IKPIs, ILeaseContract } from '../types';
import { TrendingUp, AlertCircle, ShieldCheck, PieChart, Calendar, Loader2, Download, FileText, X, Eye, MapPin, Building, DollarSign } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL;

export default function Dashboard() {
  const [kpis, setKpis] = useState<IKPIs | null>(null);
  const [contracts, setContracts] = useState<ILeaseContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<ILeaseContract | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { token } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpiRes, contractRes] = await Promise.all([
          fetch(`${API_URL}/analytics/summary`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_URL}/contracts`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        if (kpiRes.ok) setKpis(await kpiRes.json());
        if (contractRes.ok) setContracts(await contractRes.json());
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    if (token) fetchData();
  }, [token]);

  const openPreview = async (contract: ILeaseContract) => {
    setSelectedContract(contract);
    const res = await fetch(`${API_URL}/contracts/${contract.id}/presigned_url`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setPreviewUrl(data.presigned_url);
  };

  const handleDownload = async (contractId: string, filename: string) => {
    const res = await fetch(`${API_URL}/contracts/${contractId}/presigned_url`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const a = document.createElement('a'); a.href = data.presigned_url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleBulkDownload = () => {
    selectedIds.forEach(id => {
      const c = contracts.find(x => x.id === id);
      if (c) handleDownload(c.id, c.filename);
    });
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-accent-electric" /></div>;

  return (
    <div className="p-10 space-y-10 font-sans">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-1">Panel de Control Legal</h1>
          <p className="text-gray-500 text-sm italic">Gestión proactiva de riesgos y cumplimiento.</p>
        </div>
        {selectedIds.length > 0 && (
          <motion.button 
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={handleBulkDownload}
            className="bg-accent-electric text-black px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-white transition-all shadow-lg"
          >
            <Download size={14} /> DESCARGAR SELECCIONADOS ({selectedIds.length})
          </motion.button>
        )}
      </header>

      {/* KPIs Estratégicos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Valor Portafolio', value: formatCurrency(kpis?.total_mrr || 0), icon: TrendingUp, color: 'text-accent-electric' },
          { label: 'Riesgo Vencimiento', value: kpis?.upcoming_expirations || 0, icon: Calendar, color: 'text-orange-500' },
          { label: 'Salud Contractual', value: `${kpis?.compliance_score || 0}%`, icon: ShieldCheck, color: 'text-emerald-500' },
          { label: 'Contratos Activos', value: kpis?.active_contracts || 0, icon: PieChart, color: 'text-blue-500' },
        ].map((kpi, i) => (
          <div key={i} className="bg-[#0a0a0a] border border-white/5 p-6 rounded-2xl hover:border-accent-electric/30 transition-all shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest">{kpi.label}</p>
              <kpi.icon className={cn("w-4 h-4", kpi.color)} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{kpi.value}</h2>
          </div>
        ))}
      </div>

      {/* Tabla de Gestión */}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-white/2 text-gray-500 font-bold uppercase tracking-[0.2em] border-b border-white/5">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Arrendatario / Zona</th>
                <th className="px-6 py-4">Renta</th>
                <th className="px-6 py-4">Vencimiento</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {contracts.map((c) => (
                <tr key={c.id} className={cn("hover:bg-white/2 transition-colors", selectedIds.includes(c.id) && "bg-accent-electric/5")}>
                  <td className="px-6 py-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(c.id)}
                      onChange={(e) => e.target.checked ? setSelectedIds([...selectedIds, c.id]) : setSelectedIds(selectedIds.filter(x => x !== c.id))}
                      className="accent-accent-electric w-4 h-4"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-200 text-sm">{c.tenant_name || c.filename}</p>
                    <p className="text-[9px] text-gray-500 flex items-center gap-1 uppercase tracking-wider">
                      <MapPin size={10} /> {c.property_zone || 'Zona no especificada'}
                    </p>
                  </td>
                  <td className="px-6 py-4 font-mono text-accent-electric font-bold text-sm">
                    {c.monthly_rent ? formatCurrency(c.monthly_rent) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-gray-400 font-mono italic">{c.expiry_date || 'En proceso'}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                      c.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" :
                      c.status === 'error' ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button onClick={() => openPreview(c)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all shadow-lg border border-white/5"><Eye size={16} /></button>
                    <button onClick={() => handleDownload(c.id, c.filename)} className="p-2.5 bg-accent-electric/10 hover:bg-accent-electric/20 rounded-xl text-accent-electric transition-all shadow-lg border border-accent-electric/10"><Download size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE PREVISUALIZACIÓN */}
      <AnimatePresence>
        {selectedContract && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0a0a0a] border border-white/10 w-full max-w-7xl h-[90vh] rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#0d0d0d]">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-accent-electric/10 rounded-2xl text-accent-electric shadow-inner"><FileText size={24}/></div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">{selectedContract.filename}</h3>
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Contrato ID: {selectedContract.id}</p>
                  </div>
                </div>
                <button onClick={() => {setSelectedContract(null); setPreviewUrl(null);}} className="p-3 hover:bg-white/5 rounded-full transition-all text-gray-400 hover:text-white border border-transparent hover:border-white/10"><X size={24}/></button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Visualizador de PDF */}
                <div className="flex-[2] bg-[#141414] p-6 relative border-r border-white/5">
                  {previewUrl ? (
                    <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full rounded-2xl shadow-inner border border-white/5" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4">
                      <Loader2 className="animate-spin text-accent-electric w-10 h-10"/> 
                      <p className="text-xs font-black uppercase tracking-[0.3em]">Accediendo al servidor seguro...</p>
                    </div>
                  )}
                </div>

                {/* Panel de Metadatos Extraídos */}
                <div className="flex-1 bg-[#0a0a0a] p-10 space-y-10 overflow-y-auto">
                  <section className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent-electric flex items-center gap-2">
                      <ShieldCheck size={14}/> Análisis de Extracción IA
                    </h4>
                    <div className="space-y-4">
                      <div className="p-5 bg-white/2 border border-white/5 rounded-2xl flex items-center gap-5 hover:bg-white/5 transition-all">
                        <Building size={20} className="text-gray-500" />
                        <div><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Arrendatario</p><p className="text-base font-bold text-white">{selectedContract.tenant_name || 'No detectado'}</p></div>
                      </div>
                      <div className="p-5 bg-white/2 border border-white/5 rounded-2xl flex items-center gap-5 hover:bg-white/5 transition-all">
                        <DollarSign size={20} className="text-gray-500" />
                        <div><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Monto Mensual</p><p className="text-lg font-black text-accent-electric font-mono">{formatCurrency(selectedContract.monthly_rent || 0)} {selectedContract.currency}</p></div>
                      </div>
                      <div className="p-5 bg-white/2 border border-white/5 rounded-2xl flex items-center gap-5 hover:bg-white/5 transition-all">
                        <MapPin size={20} className="text-gray-500" />
                        <div><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Zona Propiedad</p><p className="text-base font-bold text-white">{selectedContract.property_zone || 'Zona no detectada'}</p></div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-600 italic">Cronología Legal</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/2 border border-white/5 rounded-2xl"><p className="text-[9px] text-gray-600 uppercase font-black tracking-widest mb-1">Expiración</p><p className="text-sm font-mono text-white">{selectedContract.expiry_date || 'N/A'}</p></div>
                      <div className="p-4 bg-white/2 border border-white/5 rounded-2xl"><p className="text-[9px] text-gray-600 uppercase font-black tracking-widest mb-1">Confianza</p><p className="text-sm font-mono text-emerald-500 font-bold">98.4%</p></div>
                    </div>
                  </section>

                  <div className="pt-6">
                    <button 
                      onClick={() => handleDownload(selectedContract.id, selectedContract.filename)}
                      className="w-full bg-accent-electric text-black py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(0,240,255,0.2)]"
                    >
                      <Download size={18} /> Descargar Contrato Original
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
