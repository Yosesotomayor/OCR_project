import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Users,
  LogOut,
  Zap,
  CreditCard,
  Terminal
} from 'lucide-react';
import { cn } from '../utils';
import { useAuth } from '../hooks/useAuth';

const baseNavItems = [ // Renamed to baseNavItems
  { icon: LayoutDashboard, label: 'Inteligencia', href: '/dashboard' },
  { icon: MessageSquare, label: 'Chat AI', href: '/dashboard/chat' },
  { icon: FileText, label: 'Contratos', href: '/dashboard/documents' },
  { icon: CreditCard, label: 'Suscripción', href: '/dashboard/subscription', adminOnly: false }, // Added adminOnly flag
  { icon: Users, label: 'Acceso', href: '/dashboard/admin', adminOnly: true }, // Added adminOnly flag
];

export default function DashboardLayout() {
  const { logout, isAdmin } = useAuth(); // Get isAdmin from useAuth

  const navItems = baseNavItems.filter(item => !item.adminOnly || isAdmin); // Filter navItems

  return (
    <div className="flex h-screen w-full bg-[#050505] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#050505] border-r border-[#1f1f1f] flex flex-col">
        <div className="p-6">
          <div className="flex flex-col gap-1 mb-10">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent-electric fill-accent-electric" />
              <span className="font-bold text-lg tracking-tighter">LeaseLens AI</span>
            </div>
            <span className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">
              Smart Contract Intelligence
            </span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/dashboard'}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group",
                  isActive
                    ? "bg-accent-electric/5 text-accent-electric border border-accent-electric/20"
                    : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="font-medium text-sm">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-[#1f1f1f] space-y-4">
          {isAdmin && (
            <NavLink
              to="/dashboard/admin/logs"
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300",
                isActive
                  ? "bg-accent-electric/10 text-accent-electric border border-accent-electric/20"
                  : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
              )}
            >
              <Terminal className="w-4 h-4" />
              <span className="font-medium text-sm">Panel de Logs</span>
            </NavLink>
          )}

          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full text-gray-500 hover:text-red-400 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Salir</span>
          </button>
        </div>      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-[#050505]">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent-electric/20 to-transparent" />
        <Outlet />
      </main>
    </div>
  );
}
