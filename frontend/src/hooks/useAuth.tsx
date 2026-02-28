import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

interface User {
  id: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  subscription_plan?: string;
  subscription_status?: string;
  subscription_end_date?: string; // Assuming date comes as string from API
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
  updateUserSubscription: (plan: string, cycle: 'monthly' | 'annually') => Promise<void>;
  isLoggingOut: boolean; // Added isLoggingOut to context type
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false); // Added isLoggingOut state
  const navigate = useNavigate();

  const isAuthenticated = !!token;
  const isAdmin = user?.is_admin || false;

  const fetchUser = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const userData: User = await response.json();
        console.log("Fetched user data:", userData);
        setUser(userData);
      } else {
        console.error("Failed to fetch user data, logging out.");
        logout();
      }
    } catch (error) {
      console.error("Network error fetching user data:", error);
      logout();
    } finally {
      setIsLoading(false);
    }
  }, []); // Removed logout from dependency array

  useEffect(() => {
    if (token) {
      fetchUser(token);
    } else {
      setIsLoading(false);
    }
  }, [token, fetchUser]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error de autenticación');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      setToken(data.access_token);
      await fetchUser(data.access_token);
      return true;
    } catch (error: any) {
      console.error("Login error:", error.message);
      setToken(null);
      setUser(null);
      localStorage.removeItem('access_token');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    setIsLoggingOut(true); // Set logging out state
    setTimeout(() => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('access_token');
      navigate('/login');
      setIsLoggingOut(false); // Reset logging out state
    }, 500); // 500ms delay for animation
  }, [navigate]);

  const updateUserSubscription = useCallback(async (plan: string, cycle: 'monthly' | 'annually') => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/subscription/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription_plan: plan, billing_cycle: cycle }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update subscription');
      }
      const updatedUserData: User = await response.json();
      setUser(updatedUserData);
      console.log(`Subscription updated: Plan - ${plan}, Cycle - ${cycle}`);
    } catch (error) {
      console.error("Error updating subscription:", error);
      throw error; // Re-throw to be handled by the calling component
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const value = {
    user,
    token,
    isLoading,
    login,
    logout,
    isAdmin,
    isAuthenticated,
    updateUserSubscription,
    isLoggingOut, // Added isLoggingOut to value
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
