import { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { User, Shield, MoreVertical, Search, Key, ShieldAlert, Loader2, Plus, Edit, Trash2, X, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth'; // Import useAuth to get the token

const API_URL = import.meta.env.VITE_API_URL;

interface IUser {
  id: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
}

interface UserFormData {
  email: string;
  password?: string; // Optional for editing
  is_active: boolean;
  is_admin: boolean;
}

export default function Admin() {
  const { token } = useAuth(); // Get token from useAuth
  const [users, setUsers] = useState<IUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<IUser | null>(null);
  const [userFormData, setUserFormData] = useState<UserFormData>({
    email: '',
    is_active: true,
    is_admin: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!token) {
        throw new Error("No authentication token found.");
      }
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
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUserClick = () => {
    setEditingUser(null);
    setUserFormData({ email: '', password: '', is_active: true, is_admin: false });
    setFormError(null);
    setShowUserModal(true);
  };

  const handleEditUserClick = (user: IUser) => {
    setEditingUser(user);
    setUserFormData({ email: user.email, is_active: user.is_active, is_admin: user.is_admin });
    setFormError(null);
    setShowUserModal(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setUserFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    if (!token) {
      setFormError("No authentication token found.");
      setIsSubmitting(false);
      return;
    }

    try {
      let response;
      if (editingUser) {
        // Update user
        response = await fetch(`${API_URL}/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: userFormData.email,
            is_active: userFormData.is_active,
            is_admin: userFormData.is_admin,
            // Password is not updated via PUT for security reasons,
            // a separate "reset password" functionality would be needed.
          }),
        });
      } else {
        // Add user
        if (!userFormData.password) {
          setFormError("Password is required for new users.");
          setIsSubmitting(false);
          return;
        }
        response = await fetch(`${API_URL}/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(userFormData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to ${editingUser ? 'update' : 'add'} user`);
      }

      setShowUserModal(false);
      fetchUsers(); // Refresh user list
    } catch (err: any) {
      console.error("Form submission error:", err);
      setFormError(err.message || 'Error al guardar usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) return;
    setIsLoading(true); // Show loading for the whole table during deletion
    setError(null);

    if (!token) {
      setError("No authentication token found.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete user');
      }

      fetchUsers(); // Refresh user list
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setError(err.message || 'Error al eliminar usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserStatus = async (user: IUser) => {
    setIsLoading(true);
    setError(null);

    if (!token) {
      setError("No authentication token found.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/users/${user.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !user.is_active }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to toggle user status');
      }

      fetchUsers(); // Refresh user list
    } catch (err: any) {
      console.error("Error toggling user status:", err);
      setError(err.message || 'Error al cambiar estado del usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserAdminStatus = async (user: IUser) => {
    setIsLoading(true);
    setError(null);

    if (!token) {
      setError("No authentication token found.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/users/${user.id}/admin-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is_admin: !user.is_admin }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to toggle admin status');
      }

      fetchUsers(); // Refresh user list
    } catch (err: any) {
      console.error("Error toggling admin status:", err);
      setError(err.message || 'Error al cambiar rol de administrador.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.is_admin ? 'admin' : 'miembro').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.is_active ? 'activo' : 'inactivo').toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="absolute inset-0 bg-accent-electric/10 blur opacity-0 group-focus-within:opacity-100 transition-opacity rounded-xl" />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-accent-electric transition-colors" size={16} />
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
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleUserStatus(u)}
                        className={cn(
                          "p-2 rounded-full transition-colors",
                          u.is_active ? "text-emerald-500 hover:bg-emerald-500/20" : "text-red-500 hover:bg-red-500/20"
                        )}
                        title={u.is_active ? "Desactivar Usuario" : "Activar Usuario"}
                      >
                        {u.is_active ? <Check size={18} /> : <X size={18} />}
                      </button>
                      <button
                        onClick={() => toggleUserAdminStatus(u)}
                        className={cn(
                          "p-2 rounded-full transition-colors",
                          u.is_admin ? "text-accent-electric hover:bg-accent-electric/20" : "text-gray-500 hover:bg-white/20"
                        )}
                        title={u.is_admin ? "Quitar Rol Admin" : "Dar Rol Admin"}
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
                <label htmlFor="email" className="block text-gray-400 text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={userFormData.email}
                  onChange={handleFormChange}
                  className="w-full bg-[#1f1f1f] border border-[#2f2f2f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-electric/50"
                  required
                />
              </div>
              {!editingUser && ( // Password only for new users
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
              <div className="flex items-center justify-between">
                <label htmlFor="is_active" className="text-gray-400 text-sm font-medium">Activo</label>
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={userFormData.is_active}
                  onChange={handleFormChange}
                  className="h-5 w-5 text-accent-electric rounded border-gray-600 focus:ring-accent-electric"
                />
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="is_admin" className="text-gray-400 text-sm font-medium">Administrador</label>
                <input
                  type="checkbox"
                  id="is_admin"
                  name="is_admin"
                  checked={userFormData.is_admin}
                  onChange={handleFormChange}
                  className="h-5 w-5 text-accent-electric rounded border-gray-600 focus:ring-accent-electric"
                />
              </div>
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
