import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Documents from './pages/Documents';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing'; 
import Subscription from './pages/Subscription'; 
import Forbidden from './pages/Forbidden'; 
import { AuthProvider, useAuth } from './hooks/useAuth.tsx'; 
import { Zap } from 'lucide-react';

const VITE_ENABLE_LANDING_PAGE = import.meta.env.VITE_ENABLE_LANDING_PAGE === 'true';

// Componente de carga minimalista para evitar parpadeos bruscos
const LoadingScreen = () => (
  <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center">
    <Zap className="w-12 h-12 text-accent-electric animate-pulse mb-4" />
    <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em]">
      Sincronizando Protocolos...
    </p>
  </div>
);

// Componente Guardián de Rutas
const ProtectedRoute = ({ 
  children, 
  adminOnly = false 
}: { 
  children: JSX.Element, 
  adminOnly?: boolean 
}) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />; 
  }

  if (!isAuthenticated) {
    // replace evita que el usuario regrese al login con el botón "atrás"
    return <Navigate to="/login" replace />; 
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/forbidden" replace />; 
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* --- RUTAS PÚBLICAS --- */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forbidden" element={<Forbidden />} />
          
          {/* Ruta Raíz Condicional */}
          <Route 
            path="/" 
            element={
              VITE_ENABLE_LANDING_PAGE ? (
                <Landing />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            } 
          />

          {/* --- RUTAS AUTENTICADAS (Layout Anidado) --- */}
          {/* Importante: DashboardLayout DEBE contener el componente <Outlet /> 
              para que Chat, Documents, etc., se rendericen en su interior. 
          */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Ruta por defecto al entrar a /dashboard */}
            <Route index element={<Dashboard />} />
            
            {/* Rutas Hijas (Se renderizan en el Outlet de DashboardLayout) */}
            <Route path="chat" element={<Chat />} />
            <Route path="documents" element={<Documents />} />
            <Route path="subscription" element={<Subscription />} />
            
            {/* Ruta de Administración con doble validación */}
            <Route 
              path="admin" 
              element={
                <ProtectedRoute adminOnly={true}>
                  <Admin />
                </ProtectedRoute>
              } 
            />
          </Route>

          {/* --- FALLBACK (404) --- */}
          <Route 
            path="*" 
            element={
              <Navigate to={VITE_ENABLE_LANDING_PAGE ? "/" : "/dashboard"} replace />
            } 
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}