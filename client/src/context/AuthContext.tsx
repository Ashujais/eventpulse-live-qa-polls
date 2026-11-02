import React, { createContext, useContext, useState, useEffect } from 'react';
import { HostUser } from '../types/index.js';
import { api } from '../lib/api.js';

interface AuthContextType {
  hostUser: HostUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: HostUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hostUser, setHostUser] = useState<HostUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('eventpulse_host_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function verifyAuth() {
      if (token) {
        try {
          const res = await api.getMe();
          setHostUser(res.host);
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          logout();
        }
      }
      setLoading(false);
    }

    verifyAuth();
  }, [token]);

  const login = (newToken: string, user: HostUser) => {
    localStorage.setItem('eventpulse_host_token', newToken);
    setToken(newToken);
    setHostUser(user);
  };

  const logout = () => {
    localStorage.removeItem('eventpulse_host_token');
    setToken(null);
    setHostUser(null);
  };

  return (
    <AuthContext.Provider value={{ hostUser, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
