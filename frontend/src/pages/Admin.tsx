import { useState, useEffect, useCallback } from 'react';
import { cn } from '../utils';
import { User as UserIcon, Shield, Search, Key, ShieldAlert, Loader2, Plus, Edit, Trash2, X, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getUsers, createUser, updateUser, deleteUser as sdkDeleteUser } from '../client/sdk.gen';
import { type User, type UserRole, type UserStatus } from '../client/types.gen';

interface UserFormData {
  username: string;
  password?: string;
  status: UserStatus;
  role: UserRole;
}

export default function Admin() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState<UserFormData>({
    username: '',
    status: 'approved',
    role: 'user',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: apiError } = await getUsers();
      if (apiError) throw apiError;
      if (data) setUsers(data);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError(err.detail || 'Error al cargar usuarios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUserClick = () => {
    setEditingUser(null);
    setUserFormData({ username: '', password: '', status: 'approved', role: 'user' });
    setFormError(null);
    setShowUserModal(true);
  };

  const handleEditUserClick = (user: User) => {
    setEditingUser(user);
    setUserFormData({ username: user.username, status: user.status, role: user.role });
    setFormError(null);
    setShowUserModal(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setUserFormData(prev => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingUser) {
        await updateUser({
          path: { user_id: editingUser.id },
          body: {
            role: userFormData.role,
            status: userFormData.status,
          }
        });
      } else {
        if (!userFormData.password) {
          setFormError("Password is required for new users.");
          setIsSubmitting(false);
          return;
        }
        await createUser({
          body: {
            username: userFormData.username,
            password: userFormData.password,
          }
        });
      }

      setShowUserModal(false);
      fetchUsers();
    } catch (err: any) {
      console.error("Form submission error:", err);
      setFormError(err.detail || 'Error al guardar usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) return;
    setIsLoading(true);
    setError(null);

    try {
      await sdkDeleteUser({ path: { user_id: userId } });
      fetchUsers();
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setError(err.detail || 'Error al eliminar usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserStatus = async (user: User) => {
    setIsLoading(true);
    setError(null);
    try {
      await updateUser({
        path: { user_id: user.id },
        body: { status: user.status === 'approved' ? 'pending' : 'approved' }
      });
      fetchUsers();
    } catch (err: any) {
      console.error("Error toggling user status:", err);
      setError(err.detail || 'Error al cambiar estado del usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserAdminStatus = async (user: User) => {
    setIsLoading(true);
    setError(null);
    try {
      await updateUser({
        path: { user_id: user.id },
        body: { role: user.role === 'admin' ? 'user' : 'admin' }
      });
      fetchUsers();
    } catch (err: any) {
      console.error("Error toggling admin status:", err);
      setError(err.detail || 'Error al cambiar rol de administrador.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.role === 'admin' ? 'admin' : 'miembro').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.status === 'approved' ? 'activo' : 'inactivo').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-10 space-y-8 h-full flex flex-col">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2 italic">Protocolo de Acceso</h1>
          <p className="text-gray-500 text-sm">Control centralizado de inteligencia contractual.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-accent-electric transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por usuario..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-accent-electric/50 transition-all w-64"
            />
          </div>
          <button
            onClick={handleAddUserClick}
            className="flex items-center gap-2 px-5 py-3 bg-accent-electric text-black rounded-xl font-bold hover:bg-accent-electric/90 transition-colors shadow-lg"
          >
            <Plus size={20} />
            Añadir Usuario
          </button>
        </div>
      </header>

      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl overflow-hidden shadow-2xl flex-1">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#1f1f1f] bg-white/2 text-[10px] font-black uppercase tracking-widest text-gray-600">
              <th className="p-6">Identidad / Usuario</th>
              <th className="p-6">Nivel de Seguridad</th>
              <th className="p-6">Estado</th>
              <th className="p-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-gray-300 divide-y divide-[#1f1f1f]">
            {isLoading && users.length === 0 ? (
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
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <span className="font-bold text-base block tracking-tight">{u.username}</span>
                        <span className="text-[10px] text-gray-600 italic font-mono">{u.id.split('-')[0]}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit border shadow-sm",
                      u.role === 'admin' ? "bg-accent-electric/10 text-accent-electric border-accent-electric/20" : "bg-white/5 text-gray-500 border-white/10"
                    )}>
                      {u.role === 'admin' ? <ShieldAlert size={12} /> : <Key size={12} />}
                      {u.role === 'admin' ? 'Admin' : 'Miembro'}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit border shadow-sm",
                      u.status === 'approved' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20 animate-pulse"
                    )}>
                      {u.status === 'approved' ? <Check size={12} /> : <Shield size={12} />}
                      {u.status === 'approved' ? 'Activo' : 'Pendiente'}
                    </div>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleUserStatus(u)}
                        className={cn(
                          "p-2 rounded-full transition-colors",
                          u.status === 'approved' ? "text-emerald-500 hover:bg-emerald-500/20" : "text-red-500 hover:bg-red-500/20"
                        )}
                        title={u.status === 'approved' ? "Desactivar Usuario" : "Activar Usuario"}
                      >
                        {u.status === 'approved' ? <Check size={18} /> : <X size={18} />}
                      </button>
                      <button
                        onClick={() => toggleUserAdminStatus(u)}
                        className={cn(
                          "p-2 rounded-full transition-colors",
                          u.role === 'admin' ? "text-accent-electric hover:bg-accent-electric/20" : "text-gray-500 hover:bg-white/20"
                        )}
                        title={u.role === 'admin' ? "Quitar Rol Admin" : "Dar Rol Admin"}
                      >
                        <ShieldAlert size={18} />
                      </button>
                      <button
                        onClick={() => handleEditUserClick(u)}
                        className="p-2 text-blue-500 hover:bg-blue-500/20 rounded-full transition-colors"
                        title="Editar Usuario"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-2 text-red-500 hover:bg-red-500/20 rounded-full transition-colors"
                        title="Eliminar Usuario"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
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

      {/* User Add/Edit Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">
              {editingUser ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}
            </h2>
            {formError && (
              <div className="bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg p-3 mb-4 text-sm">
                {formError}
              </div>
            )}
            <form onSubmit={handleSubmitUser} className="space-y-5">
              <div>
                <label htmlFor="username" className="block text-gray-400 text-sm font-medium mb-2">Usuario</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={userFormData.username}
                  onChange={handleFormChange}
                  className="w-full bg-[#1f1f1f] border border-[#2f2f2f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-electric/50"
                  required
                  disabled={!!editingUser}
                />
              </div>
              {!editingUser && (
                <div>
                  <label htmlFor="password" className="block text-gray-400 text-sm font-medium mb-2">Contraseña</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={userFormData.password || ''}
                    onChange={handleFormChange}
                    className="w-full bg-[#1f1f1f] border border-[#2f2f2f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-electric/50"
                    required={!editingUser}
                  />
                </div>
              )}
              {editingUser && (
                <>
                  <div>
                    <label htmlFor="status" className="block text-gray-400 text-sm font-medium mb-2">Estado</label>
                    <select
                      id="status"
                      name="status"
                      value={userFormData.status}
                      onChange={handleFormChange as any}
                      className="w-full bg-[#1f1f1f] border border-[#2f2f2f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-electric/50"
                    >
                      <option value="approved">Aprobado</option>
                      <option value="pending">Pendiente</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="role" className="block text-gray-400 text-sm font-medium mb-2">Rol</label>
                    <select
                      id="role"
                      name="role"
                      value={userFormData.role}
                      onChange={handleFormChange as any}
                      className="w-full bg-[#1f1f1f] border border-[#2f2f2f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-electric/50"
                    >
                      <option value="user">Usuario</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-5 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-3 bg-accent-electric text-black rounded-xl font-bold hover:bg-accent-electric/90 transition-colors flex items-center gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="animate-spin w-5 h-5" />}
                  {editingUser ? 'Guardar Cambios' : 'Añadir Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
