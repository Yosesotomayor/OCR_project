import { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { User, Shield, MoreVertical, Search, Key, ShieldAlert, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

interface IUser {
  id: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
}

export default function Admin() {
  const [users, setUsers] = useState<IUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch users');
      }

      const data: IUser[] = await response.json();
      setUsers(data);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError(err.message || 'Error al cargar usuarios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.is_admin ? 'admin' : 'member').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-10 space-y-8 h-full flex flex-col">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2 italic">Protocolo de Acceso</h1>
          <p className="text-gray-500 text-sm">Control centralizado de inteligencia contractual.</p>
        </div>
        
        <div className="relative group">
          <div className="absolute inset-0 bg-accent-electric/10 blur opacity-0 group-focus-within:opacity-100 transition-opacity rounded-xl" />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-accent-electric transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Email o Rol..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl pl-12 pr-6 py-3.5 text-sm focus:outline-none focus:border-accent-electric/50 transition-all w-80 font-medium"
          />
        </div>
      </header>

      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl overflow-hidden shadow-2xl flex-1">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#1f1f1f] bg-white/2 text-[10px] font-black uppercase tracking-widest text-gray-600">
              <th className="p-6">Identidad / Email</th>
              <th className="p-6">Nivel de Seguridad</th>
              <th className="p-6">Estado</th>
              <th className="p-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-gray-300 divide-y divide-[#1f1f1f]">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  Cargando usuarios...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-red-500">
                  Error: {error}
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  No se encontraron usuarios.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="group hover:bg-white/2 transition-all">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-electric/20 to-indigo-900/20 border border-accent-electric/10 flex items-center justify-center text-accent-electric group-hover:scale-105 transition-transform shadow-lg">
                        <User size={20} />
                      </div>
                      <div>
                        <span className="font-bold text-base block tracking-tight">{u.email}</span>
                        <span className="text-[10px] text-gray-600 italic font-mono">{u.id.split('-')[0]}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit border shadow-sm",
                      u.is_admin ? "bg-accent-electric/10 text-accent-electric border-accent-electric/20" : "bg-white/5 text-gray-500 border-white/10"
                    )}>
                      {u.is_admin ? <ShieldAlert size={12} /> : <Key size={12} />}
                      {u.is_admin ? 'Admin' : 'Miembro'}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit border shadow-sm",
                      u.is_active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                    )}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </div>
                  </td>
                  <td className="p-6 text-right">
                    <button className="p-3 text-gray-700 hover:text-white hover:bg-white/5 rounded-xl transition-all inline-flex items-center justify-center group/btn">
                      <MoreVertical size={20} className="group-hover/btn:rotate-90 transition-transform" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-700 pt-4">
        <span>© 2026 LeaseLens AI - Enterprise Security Tier</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 text-emerald-500/60">
            <Shield size={10} />
            Módulo de Cifrado Activo
          </span>
        </div>
      </footer>
    </div>
  );
}
