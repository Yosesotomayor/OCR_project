import { useState, useMemo } from 'react';
import * as RW from 'react-window';
import { cn } from '../lib/utils';
import { FileUp, FileText, CheckCircle, Clock, Search, Filter, Calendar, MapPin, DollarSign } from 'lucide-react';
import { ILeaseContract, LeaseStatus, OccupancyType } from '../types';

// Workaround for react-window CommonJS build issue in Vite/Rollup
const List = (RW as any).FixedSizeList || (RW as any).default?.FixedSizeList || RW.FixedSizeList;

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<LeaseStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<OccupancyType | 'all'>('all');

  // Simulated large data set
  const contracts: ILeaseContract[] = useMemo(() => {
    const statuses: LeaseStatus[] = ['active', 'pending_renewal', 'expired'];
    const types: OccupancyType[] = ['residential', 'commercial', 'industrial', 'retail'];
    const names = ['Global Logistics S.A.', 'Tech Innovations LLC', 'Urban Green Apartments', 'Southside Retail Hub'];
    const zones = ['Zona Norte', 'Zona Sur', 'Parque Industrial', 'Centro Histórico'];
    
    return Array.from({ length: 1000 }).map((_, i) => ({
      id: `CT-${1000 + i}`,
      tenant: names[i % names.length] + ` - ${i}`,
      monthly_rent: Math.floor(Math.random() * 10000) + 1500,
      expiry_date: `202${Math.floor(Math.random() * 5 + 4)}-0${Math.floor(Math.random() * 9 + 1)}-15`,
      status: statuses[i % statuses.length],
      occupancy_type: types[i % types.length],
      property_name: `Edificio ${zones[i % zones.length]} Nivel ${i % 10}`,
      property_zone: zones[i % zones.length]
    }));
  }, []);

  const filteredContracts = contracts.filter(c => {
    const matchesSearch = c.tenant.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchesType = filterType === 'all' || c.occupancy_type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => {
    const doc = filteredContracts[index];
    if (!doc) return null;

    return (
      <div style={style} className="group border-b border-[#1f1f1f] hover:bg-white/2 transition-colors flex items-center px-6">
        <div className="w-12 h-12 rounded-lg bg-accent-electric/5 flex items-center justify-center text-accent-electric group-hover:scale-110 transition-transform mr-6 shrink-0">
          <FileText size={18} />
        </div>
        
        <div className="flex-1 grid grid-cols-4 gap-4 items-center">
          <div className="flex flex-col">
            <span className="font-bold text-sm text-gray-200">{doc.tenant}</span>
            <span className="text-[10px] text-gray-500 font-mono">{doc.id}</span>
          </div>

          <div className="flex flex-col">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider w-fit mb-1",
              doc.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : 
              doc.status === 'pending_renewal' ? "bg-accent-electric/10 text-accent-electric animate-pulse" : "bg-red-500/10 text-red-500"
            )}>
              {doc.status === 'active' ? <CheckCircle size={10} /> : <Clock size={10} />}
              {doc.status.replace('_', ' ')}
            </div>
            <span className="text-[10px] text-gray-500 capitalize">{doc.occupancy_type}</span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-xs font-bold text-gray-300">
              <DollarSign size={12} className="text-emerald-500/60" />
              {new Intl.NumberFormat('en-US').format(doc.monthly_rent)}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
              <Calendar size={10} />
              {doc.expiry_date}
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-xs text-gray-400 font-medium truncate">{doc.property_name}</span>
            <div className="flex items-center gap-1 text-[10px] text-gray-600 mt-1">
              <MapPin size={10} />
              {doc.property_zone}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3 ml-6">
          <button className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors p-2 uppercase tracking-tighter">Detalles</button>
          <button className="text-[10px] font-bold text-red-500/30 hover:text-red-500 transition-colors p-2 uppercase tracking-tighter">Eliminar</button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-10 h-full flex flex-col overflow-hidden">
      <header className="mb-8 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2">Repositorio Contractual</h1>
          <p className="text-gray-500 text-sm">Filtre y gestione miles de contratos con latencia cero.</p>
        </div>
        <button className="bg-accent-electric hover:bg-accent-electric-hover text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-accent-electric/20 active:scale-95">
          <FileUp size={18} />
          Ingestar Contrato
        </button>
      </header>

      {/* Advanced Filters */}
      <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
          <input 
            type="text" 
            placeholder="Buscar por Tenant, ID o Propiedad..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-10 py-3 text-sm focus:outline-none focus:border-accent-electric/50 transition-colors"
          />
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
            <select 
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-accent-electric/50 appearance-none text-gray-400 font-medium"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="all">Todos los Status</option>
              <option value="active">Activos</option>
              <option value="pending_renewal">Pendientes</option>
              <option value="expired">Vencidos</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
            <select 
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-accent-electric/50 appearance-none text-gray-400 font-medium"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <option value="all">Tipo Inmueble</option>
              <option value="residential">Residencial</option>
              <option value="commercial">Comercial</option>
              <option value="industrial">Industrial</option>
              <option value="retail">Retail</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Virtualized Table */}
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col">
        <div className="grid grid-cols-4 gap-4 px-6 py-4 bg-white/2 border-b border-[#1f1f1f] text-[10px] font-black uppercase tracking-widest text-gray-600 shrink-0 pr-32">
          <div className="pl-14">Tenant / ID</div>
          <div>Status / Tipo</div>
          <div>Renta / Vence</div>
          <div>Propiedad / Zona</div>
        </div>
        <div className="flex-1 min-h-0">
          <List
            height={600}
            itemCount={filteredContracts.length}
            itemSize={80}
            width="100%"
            className="scrollbar-hide"
          >
            {Row}
          </List>
        </div>
      </div>
      
      <div className="mt-4 flex justify-between items-center px-2 shrink-0">
        <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
          Resultados: {filteredContracts.length} contratos encontrados
        </span>
        <span className="text-[10px] text-gray-700 font-medium italic">
          Virtualized View enabled for 1,000+ records.
        </span>
      </div>
    </div>
  );
}
