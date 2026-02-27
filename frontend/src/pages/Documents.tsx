import { useState, useMemo, useEffect, useRef, memo, useCallback } from 'react';
import { cn } from '../lib/utils';
import { 
  FileUp, FileText, CheckCircle, Search, 
  Calendar, MapPin, DollarSign, Zap, AlertTriangle, X 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

export interface ILeaseContract {
  id: string;
  filename: string;
  status: 'processing' | 'completed' | 'error';
  tenant_name?: string;
  monthly_rent?: number;
  currency?: string;
  expiry_date?: string;
  property_name?: string;
  property_zone?: string;
}

// --- Status Badge ---
const StatusBadge = memo(({ status, contractId, onFinished }: { status: string, contractId: string, onFinished: () => void }) => {
  useEffect(() => {
    if (status !== 'processing') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/contracts/${contractId}/exists`); // Use exists endpoint for polling
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'exists') { // Assuming 'exists' means it's processed or at least in DB
            const contractRes = await fetch(`${API_URL}/contracts/${contractId}`);
            const contractData = await contractRes.json();
            if (contractData.status !== 'processing') {
              clearInterval(interval);
              onFinished();
            }
          }
        } else if (res.status === 404) { // Contract not found yet, keep polling
          // Do nothing, continue polling
        } else {
          console.error("Error en polling:", res.status);
          clearInterval(interval);
          onFinished(); // Stop polling on other errors
        }
      } catch (e) {
        console.error("Error en polling:", e);
        clearInterval(interval);
        onFinished(); // Stop polling on network errors
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [status, contractId, onFinished]);

  const config = {
    processing: { color: "bg-accent-electric/10 text-accent-electric", icon: Zap, label: "Analizando", anim: "animate-pulse" },
    completed: { color: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle, label: "Completado", anim: "" },
    error: { color: "bg-red-500/10 text-red-500", icon: AlertTriangle, label: "Error", anim: "" },
  };

  const current = config[status as keyof typeof config] || config.error;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider w-fit border border-white/5", 
      current.color, current.anim
    )}>
      <current.icon size={12} />
      {current.label}
    </div>
  );
});

// --- Fila Nativa (Sin Virtualización Innecesaria) ---
const ContractRow = ({ doc, fetchContracts, onSelectContract }: { doc: ILeaseContract, fetchContracts: () => void, onSelectContract: (contract: ILeaseContract) => void }) => {
  return (
    <div className="group border-b border-[#1f1f1f] hover:bg-white/[0.02] transition-colors flex items-center px-6 py-4">
      <div className="w-10 h-10 rounded-lg bg-accent-electric/5 flex items-center justify-center text-accent-electric group-hover:scale-110 transition-transform mr-6 shrink-0">
        <FileText size={18} />
      </div>
      
      <div className="flex-1 grid grid-cols-4 gap-4 items-center">
        <div className="flex flex-col">
          <span className="font-bold text-sm text-gray-200 truncate">{doc.tenant_name || doc.filename}</span>
          <span className="text-[10px] text-gray-500 font-mono uppercase">{doc.id.split('-')[0]}</span>
        </div>

        <div className="flex flex-col">
          <StatusBadge status={doc.status} contractId={doc.id} onFinished={fetchContracts} />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-xs font-bold text-gray-300">
            <DollarSign size={12} className="text-emerald-500/60" />
            {doc.monthly_rent ? new Intl.NumberFormat('es-MX').format(doc.monthly_rent) : '---'}
            <span className="text-[9px] ml-1 text-gray-500">{doc.currency || 'MXN'}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
            <Calendar size={10} />
            {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : 'Pendiente'}
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-400 font-medium truncate">{doc.property_name || 'Sin asignar'}</span>
          <div className="flex items-center gap-1 text-[10px] text-gray-600 mt-1">
            <MapPin size={10} />
            {doc.property_zone || 'Zona pendiente'}
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-3 ml-6">
        <button 
          onClick={() => onSelectContract(doc)}
          className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors p-2 uppercase tracking-tighter"
        >
          Detalles
        </button>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function Documents() {
  const [contracts, setContracts] = useState<ILeaseContract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ILeaseContract | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token'); // Assuming token is stored in localStorage
      const response = await fetch(`${API_URL}/contracts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Fallo al conectar con el servidor");
      const data = await response.json();
      setContracts(data);
    } catch (err) {
      console.error("Error cargando contratos:", err);
    }
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const handleFileUpload = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      alert('Por favor, sube un archivo PDF válido.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (response.ok) {
        await fetchContracts();
      } else {
        const errorData = await response.json();
        console.error("Error en la subida:", errorData.detail || response.statusText);
        alert(`Error al subir el archivo: ${errorData.detail || response.statusText}`);
      }
    } catch (err) {
      console.error("Error en la subida:", err);
      alert('Error de red al subir el archivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleSelectContract = async (contract: ILeaseContract) => {
    setSelectedContract(contract);
    setPdfUrl(null); // Clear previous PDF
    if (contract.status === 'completed') {
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_URL}/contracts/${contract.id}/presigned_url`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setPdfUrl(data.presigned_url);
        } else {
          const errorData = await response.json();
          console.error("Error fetching presigned URL:", errorData.detail || response.statusText);
          alert(`Error al obtener URL del PDF: ${errorData.detail || response.statusText}`);
        }
      } catch (error) {
        console.error("Network error fetching presigned URL:", error);
        alert('Error de red al obtener URL del PDF.');
      }
    }
  };

  const handleCloseDrawer = () => {
    setSelectedContract(null);
    setPdfUrl(null);
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const matchesSearch = (c.tenant_name?.toLowerCase() || c.filename.toLowerCase())
                            .includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [contracts, searchTerm, filterStatus]);

  return (
    <div className="p-10 h-full flex overflow-hidden bg-[#050505] text-white">
      <div className={cn("flex flex-col h-full transition-all duration-300", selectedContract ? "w-2/3" : "w-full")}>
        <header className="mb-8 flex justify-between items-end shrink-0">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">Repositorio</h1>
            <p className="text-gray-500 text-sm">Auditoría inteligente de contratos sobre RTX 4060.</p>
          </div>
          
          <div 
            className={cn(
              "relative flex items-center justify-center p-4 border-2 border-dashed rounded-xl text-gray-500 transition-colors",
              isDragOver ? "border-accent-electric bg-accent-electric/10" : "border-[#1f1f1f] hover:border-accent-electric/50"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input 
              type="file" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              accept=".pdf" 
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
              disabled={isUploading}
            />
            <div className="flex items-center gap-2 text-sm font-bold">
              {isUploading ? <Zap className="animate-spin" size={18} /> : <FileUp size={18} />}
              {isUploading ? "Analizando..." : "Arrastra tu PDF aquí o haz click para subir"}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
          <div className="relative col-span-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por inquilino o nombre de archivo..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-10 py-3 text-sm text-white focus:outline-none focus:border-accent-electric/50 transition-colors"
            />
          </div>
          
          <select 
            className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-4 py-3 text-sm text-gray-400 focus:outline-none focus:border-accent-electric/50"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="processing">Procesando</option>
            <option value="completed">Completados</option>
            <option value="error">Errores</option>
          </select>
        </div>
        
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl overflow-hidden flex-1 flex flex-col">
          <div className="grid grid-cols-4 gap-4 px-6 py-4 bg-white/[0.03] border-b border-[#1f1f1f] text-[10px] font-black uppercase tracking-widest text-gray-600 shrink-0 pr-32">
            <div className="pl-14">Inquilino / Documento</div>
            <div>Estado de IA</div>
            <div>Renta Mensual</div>
            <div>Propiedad</div>
          </div>
          
          {/* Contenedor Nativo Scrollable - Adiós react-window */}
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-[#1f1f1f] scrollbar-track-transparent">
            {filteredContracts.length > 0 ? (
              filteredContracts.map((doc) => (
                <ContractRow key={doc.id} doc={doc} fetchContracts={fetchContracts} onSelectContract={handleSelectContract} />
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-600">
                <FileText size={48} className="mb-4 opacity-10" />
                <p className="text-sm font-medium">No se encontraron contratos registrados.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side Drawer for PDF Preview */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-1/3 bg-[#0a0a0a] border-l border-[#1f1f1f] shadow-lg transform transition-transform duration-300 ease-in-out",
        selectedContract ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex justify-between items-center p-6 border-b border-[#1f1f1f]">
          <h2 className="text-xl font-bold text-gray-100">
            {selectedContract?.filename || "Previsualización de Contrato"}
          </h2>
          <button onClick={handleCloseDrawer} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 h-[calc(100%-77px)]"> {/* Adjust height based on header */}
          {selectedContract && selectedContract.status === 'processing' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Zap className="animate-pulse mb-4" size={48} />
              <p className="text-lg font-medium">Analizando documento...</p>
              <p className="text-sm">La previsualización estará disponible una vez completado el análisis.</p>
            </div>
          )}
          {selectedContract && selectedContract.status === 'error' && (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
              <AlertTriangle className="mb-4" size={48} />
              <p className="text-lg font-medium">Error al procesar documento.</p>
              <p className="text-sm">Por favor, inténtalo de nuevo o contacta a soporte.</p>
            </div>
          )}
          {selectedContract && selectedContract.status === 'completed' && pdfUrl && (
            <iframe src={pdfUrl} className="w-full h-full border-none rounded-lg" title="PDF Preview"></iframe>
          )}
          {selectedContract && selectedContract.status === 'completed' && !pdfUrl && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FileText className="mb-4" size={48} />
              <p className="text-lg font-medium">Cargando previsualización...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}