import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';

export type UserRole = 'EMPLOYEE' | 'FINANCE_MANAGER' | 'CEO';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('halleyx_token');
    if (stored) {
      setToken(stored);
      api.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
      api.get('/auth/me')
        .then((r) => setUser(r.data))
        .catch(() => { localStorage.removeItem('halleyx_token'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: t, user: u } = res.data;
    localStorage.setItem('halleyx_token', t);
    api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('halleyx_token');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
