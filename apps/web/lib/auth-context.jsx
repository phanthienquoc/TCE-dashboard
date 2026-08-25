'use client';

import { useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { setAccessToken } from './api';
import { clearSession, getAccessToken, saveSession } from './session';
import { useAuthStore } from './auth-store';
import { getCurrentUser, login, logout } from '../services/auth';

// Compatibility layer: existing components can keep using useAuth(), while
// the actual auth state lives in the lightweight Zustand store.
export function AuthProvider({ children }) {
  const pathname = usePathname();

  const syncSession = useCallback((token) => {
    const nextToken = token || '';
    setAccessToken(nextToken);
    useAuthStore.getState().setAccessToken(nextToken);
  }, []);

  const signIn = useCallback(async (email, password) => {
    const session = await login(email, password);
    if (session?.accessToken) {
      saveSession(session);
      syncSession(session.accessToken);
    }
    if (!session?.mfaRequired) {
      useAuthStore.getState().setUser(await getCurrentUser());
    }
    return session;
  }, [syncSession]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      syncSession('');
      clearSession();
      useAuthStore.getState().clearAuth();
    }
  }, [syncSession]);

  const refresh = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      useAuthStore.getState().setUser(currentUser);
      return currentUser;
    } catch (error) {
      useAuthStore.getState().setUser(null);
      throw error;
    }
  }, []);

  useEffect(() => {
    // Explicit client hydration boundary. The initial Zustand state is
    // deterministic on SSR and is marked hydrated only after the browser
    // mounts, preventing SSR/client state races.
    useAuthStore.getState().setHydrated(true);
    syncSession(getAccessToken());

    const onRefreshed = (event) => {
      const token = event.detail?.accessToken || '';
      if (token) saveSession({ accessToken: token });
      syncSession(token);
    };
    const onExpired = () => {
      syncSession('');
      clearSession();
      useAuthStore.getState().clearAuth();
    };

    window.addEventListener('tce:auth-refreshed', onRefreshed);
    window.addEventListener('tce:auth-expired', onExpired);

    if (pathname === '/login') {
      useAuthStore.getState().setReady(true);
      useAuthStore.getState().setLoading(false);
    } else {
      (async () => {
        try {
          await refresh();
        } catch {
          useAuthStore.getState().setUser(null);
        } finally {
          useAuthStore.getState().setReady(true);
          useAuthStore.getState().setLoading(false);
        }
      })();
    }

    return () => {
      window.removeEventListener('tce:auth-refreshed', onRefreshed);
      window.removeEventListener('tce:auth-expired', onExpired);
    };
  }, [pathname, refresh, syncSession]);

  return children;
}

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const ready = useAuthStore((state) => state.ready);
  const loading = useAuthStore((state) => state.loading);
  const signIn = useCallback((email, password) => {
    return login(email, password).then(async (session) => {
      if (session?.accessToken) {
        saveSession(session);
        setAccessToken(session.accessToken);
        useAuthStore.getState().setAccessToken(session.accessToken);
      }
      if (!session?.mfaRequired) {
        useAuthStore.getState().setUser(await getCurrentUser());
      }
      return session;
    });
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
