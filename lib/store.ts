'use client';
import { create } from 'zustand';
import { authApi, setAccessToken, dashboardApi } from './api';
import { useTCEDataStore } from './tce-data-store';

type User = { id: string; email: string; role: string; mfaEnabled: boolean };
type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
type AuthState = {
  user: User | null;
  status: AuthStatus;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  init: () => Promise<void>;
  login: (e: string, p: string) => Promise<{ mfaRequired?: boolean; userId?: string }>;
  mfa: (id: string, c: string) => Promise<void>;
  logout: () => Promise<void>;
};

const prefetchAfterAuth = () => void useTCEDataStore.getState().prefetch();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',
  loading: true,
  initialized: false,
  error: null,
  init: async () => {
    if (get().initialized) return;
    set({ status: 'loading', loading: true, error: null });
    try {
      const r = await authApi.me();
      set({ user: r.data.user, status: 'authenticated', initialized: true });
      prefetchAfterAuth();
    } catch {
      try {
        const r = await authApi.refresh();
        setAccessToken(r.data.accessToken);
        const me = await authApi.me();
        set({ user: me.data.user, status: 'authenticated', initialized: true });
        prefetchAfterAuth();
      } catch {
        setAccessToken(null);
        set({ user: null, status: 'anonymous', initialized: true });
      }
    } finally {
      set({ loading: false });
    }
  },
  login: async (e, p) => {
    set({ status: 'loading', loading: true, error: null });
    try {
      const r = await authApi.login(e, p);
      if (r.data.mfaRequired) {
        set({ status: 'anonymous' });
        return r.data;
      }
      setAccessToken(r.data.accessToken);
      const me = await authApi.me();
      set({ user: me.data.user, status: 'authenticated', initialized: true });
      prefetchAfterAuth();
      return r.data;
    } catch (err: any) {
      set({ status: 'anonymous', error: err?.response?.data?.message ?? 'Login failed' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },
  mfa: async (id, c) => {
    set({ status: 'loading', loading: true, error: null });
    try {
      const r = await authApi.mfaLogin(id, c);
      setAccessToken(r.data.accessToken);
      const me = await authApi.me();
      set({ user: me.data.user, status: 'authenticated', initialized: true });
      prefetchAfterAuth();
    } catch (err) {
      set({ status: 'anonymous' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },
  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      useTCEDataStore.getState().clear();
      set({ user: null, status: 'anonymous', initialized: true });
    }
  },
}));

type DashboardState = {
  data: any;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
};

const normalizeDashboard = (snapshot: any) => {
  if (!snapshot) return snapshot;
  const nextPositions = Array.isArray(snapshot.nextPositions) ? snapshot.nextPositions : [];
  const promotedPoolIds = new Set(
    nextPositions
      .map((item: any) => String(item?.pool_entry_id ?? item?.poolEntryId ?? '').trim())
      .filter(Boolean)
  );
  return {
    ...snapshot,
    pools: Array.isArray(snapshot.pools)
      ? snapshot.pools.filter((pool: any) => {
          const status = String(pool?.status ?? '')
            .trim()
            .toUpperCase();
          const id = String(pool?.id ?? '').trim();
          return status !== 'PROMOTED' && !promotedPoolIds.has(id);
        })
      : snapshot.pools,
  };
};

export const useDashboardStore = create<DashboardState>(set => ({
  data: null,
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      // Bypass the shared prefetch cache after dashboard mutations so a
      // promoted pool item disappears immediately from Shared Pools.
      const r = await dashboardApi.all('WATCHING');
      const next = normalizeDashboard(r.data);
      useTCEDataStore.setState({ dashboard: next });
      set({ data: next });
    } catch (e: any) {
      set({ error: e?.response?.data?.message ?? 'Unable to load dashboard' });
    } finally {
      set({ loading: false });
    }
  },
}));
