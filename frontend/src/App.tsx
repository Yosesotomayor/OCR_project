import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Documents from './pages/Documents';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing'; // Import the new Landing page
import { AuthProvider, useAuth } from './hooks/useAuth.tsx'; // Import AuthProvider and useAuth
import { useEffect } from 'react';

const VITE_ENABLE_LANDING_PAGE = import.meta.env.VITE_ENABLE_LANDING_PAGE === 'true';

// ProtectedRoute component to guard routes
const ProtectedRoute = ({ children, adminOnly = false }: { children: JSX.Element, adminOnly?: boolean }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    // Optionally render a loading spinner or skeleton here
    return <div>Cargando...</div>; 
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />; // Redirect non-admins from admin page
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider> {/* Wrap the entire application with AuthProvider */}
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Conditional Landing Page or Redirect to Dashboard */}
          {VITE_ENABLE_LANDING_PAGE ? (
            <Route path="/" element={<Landing />} />
          ) : (
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              } 
            />
          )}

          {/* Authenticated Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="chat" element={<Chat />} />
            <Route path="documents" element={<Documents />} />
            {/* Admin Protected Route */}
            <Route 
              path="admin" 
              element={
                <ProtectedRoute adminOnly={true}>
                  <Admin />
                </ProtectedRoute>
              } 
            />
          </Route>

          {/* Fallback for any unmatched routes */}
          <Route path="*" element={<Navigate to={VITE_ENABLE_LANDING_PAGE ? "/" : "/dashboard"} replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
