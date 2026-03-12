import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { cn } from '../utils';
import { 
  FileUp, FileText, CheckCircle, Search, 
  MapPin, Zap, AlertTriangle, X, Trash2, Eye, Download, ShieldCheck, Loader2, ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { listLeases, uploadLease, deleteLease, getLeaseUrl, getLeaseProgress } from '../client/sdk.gen';
import { type LeaseOut } from '../client/types.gen';
import { toast } from 'sonner';

const StatusBadge = memo(({ status, contractId, onFinished }: { status: string, contractId: string, onFinished: () => void }) => {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (currentStatus !== 'processing' && currentStatus !== 'uploaded') return;
    const interval = setInterval(async () => {
      try {
        const { data } = await getLeaseProgress({ path: { lease_id: contractId } });
        if (data) {
          setProgress(data.progress);
          
          if (data.status !== 'processing' && data.status !== 'uploaded') { 
            setCurrentStatus(data.status); 
            clearInterval(interval); 
            onFinished(); 
          }
        }
      } catch (e) { clearInterval(interval); }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentStatus, contractId, onFinished]);

  if (currentStatus === 'processing' || currentStatus === 'uploaded') {
    return (
      <div className="w-full max-w-[100px] space-y-1">
        <div className="flex justify-between text-[7px] font-black text-accent-electric uppercase"><span>Procesando</span><span>{progress}%</span></div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden"><motion.div animate={{ width: `${progress}%` }} className="h-full bg-accent-electric shadow-[0_0_8px_#00F0FF]"/></div>
      </div>
    );
  }
  const config = { ready: { color: "text-emerald-500 bg-emerald-500/10", icon: CheckCircle, label: "Listo" }, failed: { color: "text-red-500 bg-red-500/10", icon: AlertTriangle, label: "Error" } };
  const c = config[currentStatus as keyof typeof config] || config.failed;
  return <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border border-white/5", c.color)}><c.icon size={8}/>{c.label}</div>;
});

export default function Documents() {
  const [contracts, setContracts] = useState<LeaseOut[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof LeaseOut, dir: 'asc' | 'desc' }>({ key: 'filename', dir: 'asc' });
  const [isUploading, setIsUploading] = useState(false);
  const [selectedContract, setSelectedContract] = useState<LeaseOut | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { token } = useAuth();

  const fetchContracts = useCallback(async () => {
    try {
      const { data } = await listLeases();
      if (data) setContracts(data.items);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { if (token) fetchContracts(); }, [token, fetchContracts]);

  useEffect(() => {
    const fetchPreview = async () => {
      if (selectedContract && token) {
        setIsPreviewLoading(true);
        try {
          const { data } = await getLeaseUrl({ path: { lease_id: selectedContract.id } });
          setPreviewUrl(data as string);
        } catch (err) {
          console.error('Error fetching preview URL:', err);
        } finally {
          setIsPreviewLoading(false);
        }
      } else {
        setPreviewUrl(null);
      }
    };
    fetchPreview();
  }, [selectedContract, token]);

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type === 'application/pdf');
    if (fileArray.length === 0) return;
    setIsUploading(true);
    for (const file of fileArray) {
      const { data, error } = await uploadLease({ body: { file } });
      if (data) {
        setContracts(prev => [
          {
            ...data,
            status: "uploaded"
          },
          ...prev
        ]);
      }
      if (error) {
        toast.error(error.detail);
      }
    }
    await fetchContracts(); 
    setIsUploading(false);
  };

  const handleDownload = async (id: string, filename: string) => {
    const { data } = await getLeaseUrl({ path: { lease_id: id }, query: { download: true } });
    const a = document.createElement('a'); 
    a.href = data as string; 
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleDelete = async (id: string, silent = false) => {
    if (!silent && !confirm("¿Confirmar eliminación de este contrato?")) return;
    try {
      await deleteLease({ path: { lease_id: id } });
      if (!silent) fetchContracts();
    } catch (err) { console.error(err); }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} contratos? Esta acción no se puede deshacer.`)) return;
    
    setIsUploading(true);
    for (const id of selectedIds) {
      await handleDelete(id, true);
    }
    await fetchContracts();
    setSelectedIds([]);
    setIsUploading(false);
  };

  const toggleSort = (key: keyof LeaseOut) => {
    setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  return (
    <div className="p-10 h-full flex flex-col font-sans bg-[#050505] text-white overflow-hidden">
      <header className="mb-10 flex justify-between items-end shrink-0">
        <div><h1 className="text-4xl font-black tracking-tighter mb-2">Repositorio</h1><p className="text-gray-500 text-sm italic">Base de datos de contratos inteligentes.</p></div>
        <div className="flex gap-4">
          {selectedIds.length > 0 && <button onClick={handleBulkDelete} disabled={isUploading} className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-xs font-black border border-red-500/20 hover:bg-red-500 transition-all disabled:opacity-50">ELIMINAR ({selectedIds.length})</button>}
          <div className="relative p-4 border-2 border-dashed border-white/10 rounded-2xl hover:border-accent-electric/50 transition-all cursor-pointer">
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".pdf" multiple onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
            <div className="flex items-center gap-3 text-sm font-bold text-gray-400">{isUploading ? <Loader2 className="animate-spin text-accent-electric" size={20}/> : <FileUp size={20}/>} Subir Contratos</div>
          </div>
        </div>
      </header>

      <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden flex-1 flex flex-col shadow-2xl">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-[10px]">
            <thead className="sticky top-0 bg-[#0d0d0d] text-gray-500 font-black uppercase tracking-widest border-b border-white/5 z-10">
              <tr>
                <th className="px-6 py-4 w-10"><input type="checkbox" checked={selectedIds.length === contracts.length} onChange={(e) => setSelectedIds(e.target.checked ? contracts.map(c => c.id) : [])} className="accent-accent-electric"/></th>
                <th className="px-6 py-4 cursor-pointer hover:text-accent-electric transition-colors" onClick={() => toggleSort('arrendatario')}>Arrendatario <ArrowUpDown size={10} className="inline ml-1"/></th>
                <th className="px-6 py-4 cursor-pointer hover:text-accent-electric transition-colors" onClick={() => toggleSort('renta_mensual')}>Renta <ArrowUpDown size={10} className="inline ml-1"/></th>
                <th className="px-6 py-4 cursor-pointer hover:text-accent-electric transition-colors" onClick={() => toggleSort('fecha_inicio')}>Inicio <ArrowUpDown size={10} className="inline ml-1"/></th>
                <th className="px-6 py-4 cursor-pointer hover:text-accent-electric transition-colors" onClick={() => toggleSort('fecha_fin')}>Vencimiento <ArrowUpDown size={10} className="inline ml-1"/></th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group text-gray-300">
                  <td className="px-6 py-5 text-center"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={(e) => setSelectedIds(e.target.checked ? [...selectedIds, c.id] : selectedIds.filter(id => id !== c.id))} className="accent-accent-electric"/></td>
                  <td className="px-6 py-5"><p className="font-bold text-white text-xs">{c.arrendatario || c.filename}</p><p className="text-[8px] text-gray-600 uppercase tracking-tighter">{c.estado || 'S/I'}</p></td>
                  <td className="px-6 py-5 font-mono text-accent-electric font-bold">{c.renta_mensual ? new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(Number(c.renta_mensual)) : '---'}</td>
                  <td className="px-6 py-5 font-mono">{c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString() : 'S/I'}</td>
                  <td className="px-6 py-5 font-mono">{c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString() : 'S/I'}</td>
                  <td className="px-6 py-5"><StatusBadge status={c.status} contractId={c.id} onFinished={fetchContracts} /></td>
                  <td className="px-6 py-5 text-right"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => setSelectedContract(c)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg"><Eye size={14}/></button><button onClick={() => handleDownload(c.id, c.filename)} className="p-2 bg-accent-electric/10 hover:bg-accent-electric/20 rounded-lg text-accent-electric"><Download size={14}/></button><button onClick={() => handleDelete(c.id)} className="p-2 bg-red-500/5 hover:bg-red-500/20 rounded-lg text-red-500"><Trash2 size={14}/></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedContract && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#0a0a0a] border border-white/10 w-full max-w-7xl h-[90vh] rounded-[2rem] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-white/5 flex justify-between bg-[#0d0d0d]">
                <div className="flex items-center gap-4"><div className="p-3 bg-accent-electric/10 rounded-xl text-accent-electric"><FileText size={24}/></div><div><h3 className="text-xl font-black">{selectedContract.filename}</h3></div></div>
                <button onClick={() => setSelectedContract(null)} className="p-2 hover:bg-white/5 rounded-full text-gray-400"><X size={24}/></button>
              </div>
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-[2] bg-[#141414] p-4 relative flex items-center justify-center">
                  {isPreviewLoading ? (
                    <div className="flex flex-col items-center gap-4 text-gray-500 font-black uppercase text-[10px] tracking-widest">
                      <Loader2 className="animate-spin text-accent-electric w-10 h-10" />
                      Firmando Acceso S3v4...
                    </div>
                  ) : previewUrl ? (
                    <embed 
                      src={previewUrl} 
                      type="application/pdf" 
                      className="w-full h-full rounded-xl border border-white/5 shadow-2xl" 
                    />
                  ) : (
                    <div className="text-gray-600 text-[10px] font-black uppercase tracking-widest">
                      Error al generar previsualización segura.
                    </div>
                  )}
                </div>
                <div className="flex-1 bg-[#0a0a0a] p-10 space-y-8 overflow-y-auto">
                  <h4 className="text-[10px] font-black uppercase text-accent-electric flex items-center gap-2"><ShieldCheck size={14}/> Análisis LeaseLens AI</h4>
                  <div className="space-y-4">
                    <div className="p-4 bg-white/2 rounded-2xl">Arrendatario: <b className="text-white">{selectedContract.arrendatario || '---'}</b></div>
                    <div className="p-4 bg-white/2 rounded-2xl">Renta: <b className="text-accent-electric font-mono">{selectedContract.renta_mensual ? new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(Number(selectedContract.renta_mensual)) : '---'}</b></div>
                    <div className="p-4 bg-white/2 rounded-2xl">Propiedad: <b className="text-white">{selectedContract.direccion_completa || '---'}</b></div>
                    <div className="p-4 bg-white/2 rounded-2xl"><b>{selectedContract.fecha_inicio ? new Date(selectedContract.fecha_inicio).toLocaleDateString() : 'S/I'}</b> - <b>{selectedContract.fecha_fin ? new Date(selectedContract.fecha_fin).toLocaleDateString() : 'S/I'}</b></div>
                  </div>
                  <button onClick={() => handleDownload(selectedContract.id, selectedContract.filename)} className="w-full bg-accent-electric text-black py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-white transition-all mt-auto shadow-lg"><Download size={16} /> Descargar PDF Original</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
