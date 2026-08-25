'use client';

import { useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { setAccessToken } from './api';
import { clearSession, getAccessToken, saveSession } from './session';
import { useAuthStore } from './auth-store';
import { getCurrentUser, login, logout } from '../services/auth';

// Client-only auth coordinator. Authentication state is intentionally kept
// out of SSR: localStorage/JWT are browser concerns and do not need a
// hydration gate before the protected pages can start their own client load.
export function AuthProvider({ children }) {
  const pathname = usePathname();

  useEffect(() => {
    const token = getAccessToken();
    setAccessToken(token);
    useAuthStore.getState().setAccessToken(token);
    useAuthStore.getState().setReady(true);
    useAuthStore.getState().setLoading(false);

    const onRefreshed = (event) => {
      const nextToken = event.detail?.accessToken || '';
      setAccessToken(nextToken);
      useAuthStore.getState().setAccessToken(nextToken);
    };
    const onExpired = () => {
      setAccessToken('');
      clearSession();
      useAuthStore.getState().clearAuth();
    };

    window.addEventListener('tce:auth-refreshed', onRefreshed);
    window.addEventListener('tce:auth-expired', onExpired);
    return () => {
      window.removeEventListener('tce:auth-refreshed', onRefreshed);
      window.removeEventListener('tce:auth-expired', onExpired);
    };
  }, []);

  // Populate user information in the background. This never blocks the
  // client-side route or API calls and therefore cannot create the old
  // reload/background-resume race.
  useEffect(() => {
    if (pathname === '/login' || !getAccessToken()) return;
    getCurrentUser()
      .then((user) => useAuthStore.getState().setUser(user))
      .catch(() => useAuthStore.getState().setUser(null));
  }, [pathname]);

  const signIn = useCallback(async (email, password) => {
    const session = await login(email, password);
    if (session?.accessToken) {
      saveSession(session);
      setAccessToken(session.accessToken);
      useAuthStore.getState().setAccessToken(session.accessToken);
    }
    if (!session?.mfaRequired) {
      useAuthStore.getState().setUser(await getCurrentUser());
    }
    return session;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      setAccessToken('');
      clearSession();
      useAuthStore.getState().clearAuth();
    }
  }, []);

  const refresh = useCallback(async () => {
    const currentUser = await getCurrentUser();
    useAuthStore.getState().setUser(currentUser);
    return currentUser;
  }, []);

  return children;
}

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const ready = useAuthStore((state) => state.ready);
  const loading = useAuthStore((state) => state.loading);
  const signIn = useCallback(async (email, password) => {
    const session = await login(email, password);
    if (session?.accessToken) {
      saveSession(session);
      setAccessToken(session.accessToken);
      useAuthStore.getState().setAccessToken(session.accessToken);
    }
    if (!session?.mfaRequired) {
      useAuthStore.getState().setUser(await getCurrentUser());
    }
    return session;
  }, []);
  const signOut = useCallback(async () => {
    try { await logout(); } finally {
      setAccessToken('');
      clearSession();
      useAuthStore.getState().clearAuth();
    }
  }, []);
  const refresh = useCallback(async () => {
    const currentUser = await getCurrentUser();
    useAuthStore.getState().setUser(currentUser);
    return currentUser;
  }, []);

  return {
    user,
    accessToken,
    isAuthenticated: Boolean(user),
    ready,
    loading,
    signIn,
    signOut,
    refresh,
  };
}
