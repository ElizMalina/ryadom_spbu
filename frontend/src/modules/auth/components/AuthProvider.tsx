'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CurrentUser } from '../model/types';

type AuthStatus = 'loading' | 'ready' | 'error';
type AuthContextValue = Readonly<{
  user: CurrentUser | null;
  status: AuthStatus;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}>;
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/demo-auth/session', {
        credentials: 'same-origin', cache: 'no-store', signal,
      });
      if (!response.ok) throw new Error('session_unavailable');
      const data: { user: CurrentUser | null } = await response.json();
      if (!signal?.aborted) {
        setUser(data.user);
        setStatus('ready');
      }
    } catch {
      if (!signal?.aborted) setStatus('error');
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  const logout = useCallback(async () => {
    const response = await fetch('/api/demo-auth/session', { method: 'DELETE', credentials: 'same-origin' });
    if (!response.ok) throw new Error('logout_failed');
    setUser(null);
    setStatus('ready');
    window.location.assign('/');
  }, []);
  const value = useMemo(() => ({ user, status, refresh, logout }), [user, status, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be rendered within AuthProvider');
  return ctx;
}
