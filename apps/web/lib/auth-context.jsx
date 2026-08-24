'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAccessToken } from './api';
import { clearSession, getAccessToken, saveSession } from './session';
import { getCurrentUser, login, logout } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setContextAccessToken] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncSession = useCallback((token) => {
    const nextToken = token || '';
    setAccessToken(nextToken);
    setContextAccessToken(nextToken);
  }, []);

  const signIn = useCallback(async (email, password) => {
    const session = await login(email, password);
    if (session?.accessToken) {
      saveSession(session);
      syncSession(session.accessToken);
    }
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
      syncSession('');
      clearSession();
      setUser(null);
    }
  }, [syncSession]);

  const refresh = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      setUser(null);
      throw error;
    }
  }, []);

  useEffect(() => {
    // Keep the access token across reloads. If it has expired, the Axios
    // interceptor will transparently use the HttpOnly refresh cookie.
    syncSession(getAccessToken());

    const onRefreshed = (event) => {
      const token = event.detail?.accessToken || '';
      if (token) saveSession({ accessToken: token });
      syncSession(token);
    };
    const onExpired = () => {
      syncSession('');
      clearSession();
      setUser(null);
    };

    window.addEventListener('tce:auth-refreshed', onRefreshed);
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

    return () => {
      window.removeEventListener('tce:auth-refreshed', onRefreshed);
      window.removeEventListener('tce:auth-expired', onExpired);
    };
  }, [refresh, syncSession]);

  const value = useMemo(() => ({
    user,
    accessToken,
    isAuthenticated: Boolean(user),
    ready,
    loading,
    signIn,
    signOut,
    refresh,
  }), [user, accessToken, ready, loading, signIn, signOut, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
