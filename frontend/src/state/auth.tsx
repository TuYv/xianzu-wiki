import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { clearToken, getToken } from '../api/client';
import { login as apiLogin } from '../api/auth';

interface AuthContextValue {
  isAdmin: boolean;
  login: (pw: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => getToken() !== null);

  const login = useCallback(async (pw: string) => {
    await apiLogin(pw);
    setIsAdmin(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
