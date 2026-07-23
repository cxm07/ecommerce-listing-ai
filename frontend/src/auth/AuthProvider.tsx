import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { authUnauthorizedEvent } from './authEvents';
import type { AuthRepository, AuthSession, SignInInput } from './contracts';
import { createMockAuthRepository } from './mockAuthRepository';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  signIn(input: SignInInput): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const defaultRepository = createMockAuthRepository();

export function AuthProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: AuthRepository }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let active = true;
    void repository.getSession().then((nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'anonymous');
    });
    return () => { active = false; };
  }, [repository]);

  useEffect(() => {
    const handleUnauthorized = () => {
      void repository.signOut();
      setSession(null);
      setStatus('anonymous');
    };
    window.addEventListener(authUnauthorizedEvent, handleUnauthorized);
    return () => window.removeEventListener(authUnauthorizedEvent, handleUnauthorized);
  }, [repository]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    async signIn(input) {
      const nextSession = await repository.signIn(input);
      setSession(nextSession);
      setStatus('authenticated');
    },
    async signOut() {
      await repository.signOut();
      setSession(null);
      setStatus('anonymous');
    },
  }), [repository, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
