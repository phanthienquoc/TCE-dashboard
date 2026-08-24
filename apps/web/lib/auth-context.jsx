'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken } from './api';
import { clearSession, getAccessToken, saveSession } from './session';
import { getCurrentUser, login, logout } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncSession = useCallback((token) => {
    setAccessToken(token || '');
    if (token) saveSession({ accessToken: token });
  }, []);

  const signIn = useCallback(async (email, password) => {
    const session = await login(email, password);
    if (session?.accessToken) syncSession(session.accessToken);
    if (!session?.mfaRequired) {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    }
    return session;
  }, [syncSession]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      setAccessToken('');
      clearSession();
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      const token = getAccessToken();
      if (token) setAccessToken(token);
      return currentUser;
    } catch (error) {
      setUser(null);
      throw error;
    }
  }, []);

  useEffect(() => {
    setAccessToken(getAccessToken());

    const onExpired = () => {
      setAccessToken('');
      clearSession();
      setUser(null);
    };

    window.addEventListener('tce:auth-expired', onExpired);

    (async () => {
      try {
        await refresh();
      } catch {
        setUser(null);
      } finally {
        setReady(true);
        setLoading(false);
      }
    })();

    return () => window.removeEventListener('tce:auth-expired', onExpired);
  }, [refresh]);

  const value = useMemo(() => ({
    user,
    accessToken: getAccessToken(),
    isAuthenticated: Boolean(user),
    ready,
    loading,
    signIn,
    signOut,
    refresh,
  }), [user, ready, loading, signIn, signOut, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
