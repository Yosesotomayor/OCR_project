import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, login as sdkLogin, authStatus, bootstrapAdmin } from '../client/sdk.gen';
import { type User, type UserRole } from '../client/types.gen';
import '../api/client'; // Initialize client config

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoggingOut: boolean;
  checkAuthStatus: () => Promise<any>;
  bootstrap: (username: string, password: string) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  const isAuthenticated = !!token;
  const isAdmin = user?.role === 'admin';

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await getMe();
      if (data) {
        setUser(data);
      } else {
        logout();
      }
    } catch (error) {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data } = await authStatus();
        const initialized = data as boolean;
        
        if (!initialized) {
          navigate('/bootstrap');
          setIsLoading(false);
          return;
        }

        if (token) {
          await fetchUser();
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [token, fetchUser, navigate]);

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { data, error } = await sdkLogin({
        body: { username, password }
      });

      if (error) {
        throw new Error((error as any).detail || 'Error de autenticación');
      }

      if (data) {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        setToken(data.access_token);
        await fetchUser();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error("Login error:", error.message);
      setToken(null);
      setUser(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    setIsLoggingOut(true);
    setTimeout(() => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      navigate('/login');
      setIsLoggingOut(false);
    }, 500);
  }, [navigate]);

  const checkAuthStatus = async () => {
    const { data } = await authStatus();
    console.log("Auth status:", data);
    return data;
  };

  const bootstrap = async (username: string, password: string) => {
    const { data, error } = await bootstrapAdmin({
      body: { username, password }
    });
    if (error) throw error;
    return data!;
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    logout,
    isAdmin,
    isAuthenticated,
    isLoggingOut,
    checkAuthStatus,
    bootstrap
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
