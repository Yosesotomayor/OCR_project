import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { cn } from '../lib/utils';
import { 
  FileUp, FileText, CheckCircle, Search, 
  MapPin, Zap, AlertTriangle, X, Trash2, Eye, Download, Building, ShieldCheck, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL;

export interface ILeaseContract {
  id: string;
  filename: string;
  status: 'processing' | 'completed' | 'error';
  progress: number;
  tenant_name?: string;
  monthly_rent?: number;
  currency?: string;
  expiry_date?: string;
  property_name?: string;
  property_zone?: string;
}

const StatusBadge = memo(({ status, progress: initialProgress, contractId, onFinished }: { status: string, progress: number, contractId: string, onFinished: () => void }) => {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [progress, setProgress] = useState(initialProgress);
  const { token } = useAuth();

  useEffect(() => {
    if (currentStatus !== 'processing') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/contracts/${contractId}/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProgress(data.progress);
          if (data.status !== 'processing') {
            setCurrentStatus(data.status);
            clearInterval(interval);
            onFinished();
          }
        }
      } catch (e) { clearInterval(interval); }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentStatus, contractId, onFinished, token]);

  if (currentStatus === 'processing') {
    return (
      <div className="w-full max-w-[120px] space-y-1.5">
        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-tighter text-accent-electric">
          <div className="flex items-center gap-1"><Zap size={8} className="animate-pulse"/> Analizando</div>
          <span>{progress}%</span>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-accent-electric shadow-[0_0_10px_#00F0FF]"/>
        </div>
      </div>
    );
  }

  const config = {
    completed: { color: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle, label: "Completado" },
    error: { color: "bg-red-500/10 text-red-500", icon: AlertTriangle, label: "Error" },
  };
  const current = config[currentStatus as keyof typeof config] || config.error;
  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider w-fit border border-white/5", current.color)}>
      <current.icon size={10} /> {current.label}
    </div>
  );
});

export default function Documents() {
  const [contracts, setContracts] = useState<ILeaseContract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ILeaseContract | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { token } = useAuth();

  const fetchContracts = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/contracts`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) setContracts(await response.json());
    } catch (err) { console.error(err); }
  }, [token]);

  useEffect(() => { if (token) fetchContracts(); }, [token, fetchContracts]);

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type === 'application/pdf');
    if (fileArray.length === 0) return;
    setIsUploading(true);
    for (const file of fileArray) {
      const formData = new FormData(); formData.append('file', file);
      await fetch(`${API_URL}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
    }
    fetchContracts();
    setIsUploading(false);
  };

  const handleOpenPreview = async (contract: ILeaseContract) => {
    // REFRESCAR METADATA ANTES DE ABRIR
    setSelectedContract(contract);
    setPreviewUrl(null);
    try {
      const res = await fetch(`${API_URL}/contracts/${contract.id}/presigned_url`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setPreviewUrl(data.presigned_url);
    } catch (e) { console.error(e); }
  };

  const handleDownload = async (contractId: string, filename: string) => {
    const res = await fetch(`${API_URL}/contracts/${contractId}/presigned_url`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const a = document.createElement('a'); a.href = data.presigned_url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Borrar?")) return;
    await fetch(`${API_URL}/admin/contracts/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchContracts();
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => (c.tenant_name?.toLowerCase() || c.filename.toLowerCase()).includes(searchTerm.toLowerCase()) && (filterStatus === 'all' || c.status === filterStatus));
  }, [contracts, searchTerm, filterStatus]);

  const isAllSelected = filteredContracts.length > 0 && selectedIds.length === filteredContracts.length;

  return (
    <div className="p-10 h-full flex flex-col font-sans bg-[#050505] text-white">
      <header className="mb-10 flex justify-between items-end shrink-0">
        <div><h1 className="text-4xl font-black tracking-tighter mb-2">Repositorio</h1><p className="text-gray-500 text-sm italic">Gestión de activos legales.</p></div>
        <div className="flex gap-4">
          {selectedIds.length > 0 && (
            <button onClick={() => { if(confirm(`Borrar ${selectedIds.length}?`)) selectedIds.forEach(id => handleDelete(id)); setSelectedIds([]); }} className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-xs font-black border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">ELIMINAR ({selectedIds.length})</button>
          )}
          <div className="relative p-4 border-2 border-dashed border-white/10 rounded-2xl hover:border-accent-electric/50 transition-all cursor-pointer">
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".pdf" multiple onChange={(e) => e.target.files && handleFileUpload(e.target.files)} disabled={isUploading} />
            <div className="flex items-center gap-3 text-sm font-bold text-gray-400">{isUploading ? <Loader2 className="animate-spin text-accent-electric" size={20}/> : <FileUp size={20}/>} {isUploading ? "Subiendo..." : "Subir PDFs"}</div>
          </div>
        </div>
      </header>

      <div className="flex gap-4 mb-6 shrink-0">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18}/><input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-2xl px-12 py-4 text-sm focus:border-accent-electric/30 outline-none transition-all"/></div>
        <select className="bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm text-gray-400 outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option value="all">Todos</option><option value="processing">Analizando</option><option value="completed">Listos</option></select>
      </div>

      <div className="bg-[#0a0a0a] border border-white/5 rounded-[2rem] overflow-hidden flex-1 shadow-2xl">
        <div className="h-full overflow-y-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-[#0d0d0d] text-gray-500 font-black uppercase tracking-[0.2em] border-b border-white/5 z-10">
              <tr>
                <th className="px-8 py-5 w-10 text-center"><input type="checkbox" checked={isAllSelected} onChange={(e) => setSelectedIds(e.target.checked ? filteredContracts.map(c => c.id) : [])} className="accent-accent-electric"/></th>
                <th className="px-8 py-5">Documento</th>
                <th className="px-8 py-5">Estatus IA</th>
                <th className="px-8 py-5">Renta</th>
                <th className="px-8 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredContracts.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-8 py-6 text-center"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={(e) => setSelectedIds(e.target.checked ? [...selectedIds, c.id] : selectedIds.filter(id => id !== c.id))} className="accent-accent-electric"/></td>
                  <td className="px-8 py-6"><p className="font-bold text-gray-200 text-sm">{c.tenant_name || c.filename}</p><p className="text-[10px] text-gray-600 font-mono mt-1 uppercase">{c.property_zone || 'Zona no detectada'}</p></td>
                  <td className="px-8 py-6"><StatusBadge status={c.status} progress={c.progress} contractId={c.id} onFinished={fetchContracts} /></td>
                  <td className="px-8 py-6 text-accent-electric font-bold text-sm">{c.monthly_rent ? new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(c.monthly_rent) : '---'}</td>
                  <td className="px-8 py-6 text-right"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleOpenPreview(c)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"><Eye size={16}/></button><button onClick={() => handleDownload(c.id, c.filename)} className="p-2.5 bg-accent-electric/10 hover:bg-accent-electric/20 rounded-xl text-accent-electric transition-all"><Download size={16}/></button><button onClick={() => handleDelete(c.id)} className="p-2.5 bg-red-500/5 hover:bg-red-500/20 rounded-xl text-red-500 transition-all"><Trash2 size={16}/></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <AnimatePresence>
        {selectedContract && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#0a0a0a] border border-white/10 w-full max-w-7xl h-[90vh] rounded-[2.5rem] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <div className="p-8 border-b border-white/5 flex justify-between bg-[#0d0d0d] shrink-0">
                <div className="flex items-center gap-4"><div className="p-3 bg-accent-electric/10 rounded-xl text-accent-electric shadow-inner"><FileText size={24}/></div><div><h3 className="text-xl font-black text-white">{selectedContract.filename}</h3><p className="text-[10px] text-gray-500 font-mono">ID: {selectedContract.id}</p></div></div>
                <button onClick={() => {setSelectedContract(null); setPreviewUrl(null);}} className="p-3 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-all"><X size={24}/></button>
              </div>
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-[2] bg-[#141414] p-6 relative border-r border-white/5">
                  {previewUrl ? (
                    <iframe 
                      src={`${previewUrl}#toolbar=0`} 
                      className="w-full h-full rounded-2xl border border-white/5 shadow-inner" 
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4">
                      <Loader2 className="animate-spin text-accent-electric w-10 h-10"/>
                      <p className="text-xs font-black uppercase tracking-widest">Cargando visor seguro...</p>
                    </div>
                  )}
                </div>
                <div className="flex-1 bg-[#0a0a0a] p-10 space-y-10 overflow-y-auto">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent-electric flex items-center gap-2"><ShieldCheck size={14}/> Análisis Legal IA</h4>
                  <div className="space-y-6">
                    <div className="p-5 bg-white/2 border border-white/5 rounded-2xl"><p className="text-[10px] text-gray-500 uppercase font-black mb-1">Arrendatario</p><p className="text-base font-bold text-white">{selectedContract.tenant_name || 'No detectado'}</p></div>
                    <div className="p-5 bg-white/2 border border-white/5 rounded-2xl"><p className="text-[10px] text-gray-500 uppercase font-black mb-1">Renta Mensual</p><p className="text-lg font-black text-accent-electric font-mono">{selectedContract.monthly_rent ? new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(selectedContract.monthly_rent) : '---'}</p></div>
                    <div className="p-5 bg-white/2 border border-white/5 rounded-2xl"><p className="text-[10px] text-gray-500 uppercase font-black mb-1">Zona Propiedad</p><p className="text-base font-bold text-white">{selectedContract.property_zone || '---'}</p></div>
                  </div>
                  <button onClick={() => handleDownload(selectedContract.id, selectedContract.filename)} className="w-full bg-accent-electric text-black py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white transition-all shadow-[0_0_30px_rgba(0,240,255,0.2)] mt-auto"><Download size={18} /> Descargar PDF</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
