'use client';

import { useCallback, useEffect } from 'react';
import { refreshAccessToken, setAccessToken } from './api';
import { clearSession } from './session';
import { useAuthStore } from './auth-store';
import { getCurrentUser, login, logout } from '../services/auth';

async function signIn(email, password) {
  const session = await login(email.trim(), password);
  if (session?.mfaRequired) return session;
  setAccessToken(session.accessToken);
  const user = await getCurrentUser();
  useAuthStore.getState().setAuthenticated(user, session.accessToken);
  return session;
}

async function signOut() {
  try {
    await logout();
  } finally {
    clearSession();
    setAccessToken('');
    useAuthStore.getState().setAnonymous();
  }
}

async function refresh() {
  const token = await refreshAccessToken();
  const user = await getCurrentUser();
  useAuthStore.getState().setAuthenticated(user, token);
  return user;
}

export function AuthProvider({ children }) {
  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      useAuthStore.getState().setLoading();
      try {
        // Rehydrate the short-lived access token from the backend's HttpOnly
        // refresh cookie before any authenticated page starts fetching data.
        const token = await refreshAccessToken();
        const user = await getCurrentUser();
        if (active) useAuthStore.getState().setAuthenticated(user, token);
      } catch {
        setAccessToken('');
        clearSession();
        if (active) useAuthStore.getState().setAnonymous();
      }
    };

    void bootstrap();

    const onRefreshed = (event) => {
      const nextToken = event.detail?.accessToken || '';
      setAccessToken(nextToken);
      useAuthStore.getState().setToken(nextToken);
    };
    const onExpired = () => {
      clearSession();
      setAccessToken('');
      useAuthStore.getState().setAnonymous();
    };

    window.addEventListener('tce:auth-refreshed', onRefreshed);
    window.addEventListener('tce:auth-expired', onExpired);
    return () => {
      active = false;
      window.removeEventListener('tce:auth-refreshed', onRefreshed);
      window.removeEventListener('tce:auth-expired', onExpired);
    };
  }, []);

  return children;
}

export function useAuth() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  return {
    user,
    accessToken,
    status,
    ready: status !== 'loading',
    loading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    signIn: useCallback(signIn, []),
    signOut: useCallback(signOut, []),
    refresh: useCallback(refresh, []),
  };
}
