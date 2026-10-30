'use client';
import { getAccessToken, setAccessToken } from './session-token';
import { keycloakLogoutUrl } from './keycloak-sso';
import { create } from 'zustand';
import { authApi, dashboardApi } from './api';
import { isApiRequestCancelled, normalizeApiError } from './api-errors';
import { useTCEDataStore } from './tce-data-store';
import { useStockEventStore } from './stock-event-store';
import { startAppDataWorker, useAppDataWorkerStore } from './app-data-worker';
import { useStockSyncStore } from './stock-sync-store';
import { normalizeMarketPricePayload, type MarketPrice } from './market-price-validation';

type User = { id: string; email: string; role: string; mfaEnabled: boolean };
type AuthState = {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  loading: boolean;
  initialized: boolean;
  error: string | null;
  init: () => Promise<void>;
  completeSsoLogin: (accessToken: string) => Promise<void>;
  login: (e: string, p: string) => Promise<{ mfaRequired?: boolean; userId?: string }>;
  loginWithPasskey: () => Promise<{ mfaRequired?: boolean; userId?: string }>;
  mfa: (id: string, c: string) => Promise<void>;
  logout: () => Promise<void>;
};

const prefetchAfterAuth = () => {
  void useTCEDataStore.getState().prefetch();
  void useStockEventStore.getState().load();
  void startAppDataWorker();
};

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
      if (!getAccessToken()) await authApi.refresh();
      const r = await authApi.me();
      set({ user: r.data.user, status: 'authenticated', initialized: true });
      prefetchAfterAuth();
    } catch {
      clearAccountScopedStores();
      setAccessToken(null);
      set({ user: null, status: 'anonymous', initialized: true });
    } finally {
      set({ loading: false });
    }
  },
  completeSsoLogin: async accessToken => {
    set({ status: 'loading', loading: true, error: null });
    setAccessToken(accessToken);
    try {
      const me = await authApi.me();
      if (get().user && get().user?.id !== me.data.user.id) clearAccountScopedStores();
      set({ user: me.data.user, status: 'authenticated', initialized: true });
      prefetchAfterAuth();
    } catch (err: any) {
      clearAccountScopedStores();
      setAccessToken(null);
      set({
        user: null,
        status: 'anonymous',
        error: err?.response?.data?.message ?? 'SSO sign-in failed',
        initialized: true,
      });
      throw err;
    } finally {
      set({ loading: false });
    }
  },
  login: async (e, p) => {
    set({ status: 'loading', loading: true, error: null });
    try {
      const r = await authApi.login(e, p);
      if (r.data.mfaRequired) {
        clearAccountScopedStores();
        setAccessToken(null);
        set({ user: null, status: 'anonymous' });
        return r.data;
      }
      const me = await authApi.me();
      if (get().user && get().user?.id !== me.data.user.id) clearAccountScopedStores();
      set({ user: me.data.user, status: 'authenticated', initialized: true });
      prefetchAfterAuth();
      return r.data;
    } catch (err: any) {
      clearAccountScopedStores();
      setAccessToken(null);
      set({ user: null, status: 'anonymous', error: err?.response?.data?.message ?? 'Login failed' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },
  loginWithPasskey: async () => {
    set({ status: 'loading', loading: true, error: null });
    try {
      const { signInWithPasskey } = await import('./passkey');
      const result = await signInWithPasskey();
      if (result.mfaRequired) {
        clearAccountScopedStores();
        setAccessToken(null);
        set({ user: null, status: 'anonymous' });
        return result;
      }
      const me = await authApi.me();
      if (get().user && get().user?.id !== me.data.user.id) clearAccountScopedStores();
      set({ user: me.data.user, status: 'authenticated', initialized: true });
      prefetchAfterAuth();
      return result;
    } catch (err: any) {
      clearAccountScopedStores();
      setAccessToken(null);
      set({
        user: null,
        status: 'anonymous',
        error: err?.response?.data?.message ?? err?.message ?? 'Passkey sign-in failed',
      });
      throw err;
    } finally {
      set({ loading: false });
    }
  },
  mfa: async (id, c) => {
    set({ status: 'loading', loading: true, error: null });
    try {
      const r = await authApi.mfaLogin(id, c);
      const me = await authApi.me();
      if (get().user && get().user?.id !== me.data.user.id) clearAccountScopedStores();
      set({ user: me.data.user, status: 'authenticated', initialized: true });
      prefetchAfterAuth();
    } catch (err) {
      clearAccountScopedStores();
      setAccessToken(null);
      set({ user: null, status: 'anonymous' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },
  logout: async () => {
    const logoutUrl = keycloakLogoutUrl();
    // Invalidate local account data immediately; the remote logout request may take time.
    clearAccountScopedStores();
    set({ user: null, status: 'anonymous', initialized: true });
    try {
      await authApi.logout();
    } catch {
      // Continue to the IdP logout even if the app session expired.
    } finally {
      setAccessToken(null);
      set({ user: null, status: 'anonymous', initialized: true });
    }
    if (logoutUrl && typeof window !== 'undefined') window.location.assign(logoutUrl);
  },
}));

type DashboardState = {
  data: any;
  marketPrices: Record<string, MarketPrice>;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  syncMarketPrices: (data?: any) => Promise<void>;
  clear: () => void;
};

let marketPriceTimer: ReturnType<typeof setInterval> | null = null;
let dashboardLoadController: AbortController | null = null;
let dashboardLoadVersion = 0;
let marketPriceSyncController: AbortController | null = null;

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

const stockSymbols = (snapshot: any) => {
  const rows = [
    ...(Array.isArray(snapshot?.positions) ? snapshot.positions : []),
    ...(Array.isArray(snapshot?.currentPositions) ? snapshot.currentPositions : []),
    ...(Array.isArray(snapshot?.pools) ? snapshot.pools : []),
  ];
  return [
    ...new Set(
      rows
        .map(row =>
          String(row?.symbol ?? row?.code ?? '')
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    ),
  ];
};

const mergeMarketPrices = (snapshot: any, prices: Record<string, MarketPrice>) => {
  if (!snapshot) return snapshot;
  const apply = (row: any) => {
    const symbol = String(row?.symbol ?? row?.code ?? '')
      .trim()
      .toUpperCase();
    const quote = prices[symbol];
    if (!quote) return row;
    return { ...row, marketPrice: quote.price, market_price: quote.price };
  };
  return {
    ...snapshot,
    positions: Array.isArray(snapshot.positions)
      ? snapshot.positions.map(apply)
      : snapshot.positions,
    currentPositions: Array.isArray(snapshot.currentPositions)
      ? snapshot.currentPositions.map(apply)
      : snapshot.currentPositions,
    pools: Array.isArray(snapshot.pools) ? snapshot.pools.map(apply) : snapshot.pools,
  };
};

export const useDashboardStore = create<DashboardState>(set => ({
  data: null,
  marketPrices: {},
  loading: false,
  error: null,
  load: async () => {
    dashboardLoadController?.abort();
    marketPriceSyncController?.abort();
    marketPriceSyncController = null;

    const controller = new AbortController();
    dashboardLoadController = controller;
    const requestVersion = ++dashboardLoadVersion;
    set({ loading: true, error: null });

    try {
      const r = await dashboardApi.all('WATCHING', controller.signal);
      if (controller.signal.aborted || requestVersion !== dashboardLoadVersion) return;

      const next = normalizeDashboard(r.data);
      useTCEDataStore.setState({ dashboard: next });
      set(state => ({ data: mergeMarketPrices(next, state.marketPrices) }));
      await useDashboardStore.getState().syncMarketPrices(next);

      if (controller.signal.aborted || requestVersion !== dashboardLoadVersion) return;
      if (!marketPriceTimer) {
        marketPriceTimer = setInterval(
          () => {
            void useDashboardStore.getState().syncMarketPrices();
          },
          15 * 60 * 1000
        );
      }
    } catch (error) {
      if (controller.signal.aborted || isApiRequestCancelled(error)) return;
      if (requestVersion === dashboardLoadVersion) {
        set({ error: normalizeApiError(error, 'Unable to load dashboard').message });
      }
    } finally {
      if (requestVersion === dashboardLoadVersion) {
        set({ loading: false });
        if (dashboardLoadController === controller) dashboardLoadController = null;
      }
    }
  },
  syncMarketPrices: async (snapshot?: any) => {
    marketPriceSyncController?.abort();
    marketPriceSyncController = null;

    const current = snapshot ?? useDashboardStore.getState().data;
    const symbols = stockSymbols(current);
    if (!symbols.length) return;

    const controller = new AbortController();
    marketPriceSyncController = controller;
    try {
      const response = await dashboardApi.marketPrices(symbols, controller.signal);
      if (controller.signal.aborted || marketPriceSyncController !== controller) return;
      if (response.data?.ok === false) return;

      const payload = response.data?.data;
      const normalized = normalizeMarketPricePayload(payload, symbols);
      if (normalized.rejectedCount > 0) {
        console.warn('[FE_MARKET_PRICE_SYNC_INVALID_PAYLOAD]', {
          received: Array.isArray(payload) ? payload.length : null,
          accepted: normalized.acceptedCount,
          rejected: normalized.rejectedCount,
        });
      }
      const prices = normalized.prices;
      if (!Object.keys(prices).length) return;
      set(state => ({
        marketPrices: { ...state.marketPrices, ...prices },
        data: mergeMarketPrices(state.data, prices),
      }));
    } catch (error) {
      if (!controller.signal.aborted && !isApiRequestCancelled(error)) {
        const failure = normalizeApiError(error, 'Market price sync failed');
        console.error('[FE_MARKET_PRICE_SYNC]', {
          kind: failure.kind,
          status: failure.status,
          message: failure.message,
        });
      }
    } finally {
      if (marketPriceSyncController === controller) marketPriceSyncController = null;
    }
  },
  clear: () => {
    dashboardLoadVersion += 1;
    dashboardLoadController?.abort();
    dashboardLoadController = null;
    marketPriceSyncController?.abort();
    marketPriceSyncController = null;

    if (marketPriceTimer) {
      clearInterval(marketPriceTimer);
      marketPriceTimer = null;
    }
    set({ data: null, marketPrices: {}, loading: false, error: null });
  },
}));


/**
 * Clear and invalidate every account-sensitive client cache before changing identity.
 * Public stock-event/dividend data may be fetched again; no user-scoped configuration,
 * credentials, dashboard snapshot, or worker progress should survive the transition.
 */
function clearAccountScopedStores() {
  useAppDataWorkerStore.getState().clear();
  useTCEDataStore.getState().clear();
  useStockEventStore.getState().clear();
  useDashboardStore.getState().clear();
  useStockSyncStore.getState().clear();
}
