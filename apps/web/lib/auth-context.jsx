'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAuthSessionListener, setAuthTokenProvider } from './api';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [ready, setReady] = useState(false);

  const syncFromStorage = useCallback(() => {
    const access = getAccessToken();
    const refresh = getRefreshToken();
    setAccessToken(access);
    setRefreshToken(refresh);
    return access;
  }, []);

  const setSession = useCallback((session) => {
    saveSession(session);
    setAccessToken(session.accessToken || '');
    setRefreshToken(session.refreshToken || getRefreshToken());
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setAccessToken('');
    setRefreshToken('');
  }, []);

  const onAuthSessionChanged = useCallback((session) => {
    if (!session) {
      setAccessToken('');
      setRefreshToken('');
      return;
    }
    setAccessToken(session.accessToken || getAccessToken());
    setRefreshToken(session.refreshToken || getRefreshToken());
  }, []);

  useEffect(() => {
    syncFromStorage();
    setAuthTokenProvider(() => getAccessToken());
    setAuthSessionListener(onAuthSessionChanged);
    setReady(true);

    return () => {
      setAuthTokenProvider(null);
      setAuthSessionListener(null);
    };
  }, [onAuthSessionChanged, syncFromStorage]);

  const value = useMemo(() => ({
    accessToken,
    refreshToken,
    isAuthenticated: Boolean(accessToken),
    ready,
    setSession,
    signOut,
    syncFromStorage,
  }), [accessToken, refreshToken, ready, setSession, signOut, syncFromStorage]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
