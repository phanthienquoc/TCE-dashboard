'use client';
import { create } from 'zustand';
import { authApi, setAccessToken, dashboardApi } from './api';
import { useTCEDataStore } from './tce-data-store';
import { useStockEventStore } from './stock-event-store';

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

const prefetchAfterAuth = () => {
  void useTCEDataStore.getState().prefetch();
  void useStockEventStore.getState().load();
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
      useStockEventStore.getState().clear();
      useDashboardStore.getState().clear();
      set({ user: null, status: 'anonymous', initialized: true });
    }
  },
}));

type MarketPrice = { symbol: string; price: number; tradingDate?: string };
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
        .map(row => String(row?.symbol ?? row?.code ?? '').trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
};

const mergeMarketPrices = (snapshot: any, prices: Record<string, MarketPrice>) => {
  if (!snapshot) return snapshot;
  const apply = (row: any) => {
    const symbol = String(row?.symbol ?? row?.code ?? '').trim().toUpperCase();
    const quote = prices[symbol];
    if (!quote) return row;
    return { ...row, marketPrice: quote.price, market_price: quote.price };
  };
  return {
    ...snapshot,
    positions: Array.isArray(snapshot.positions) ? snapshot.positions.map(apply) : snapshot.positions,
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
    set({ loading: true, error: null });
    try {
      const r = await dashboardApi.all('WATCHING');
      const next = normalizeDashboard(r.data);
      useTCEDataStore.setState({ dashboard: next });
      set(state => ({ data: mergeMarketPrices(next, state.marketPrices) }));
      await useDashboardStore.getState().syncMarketPrices(next);
      if (!marketPriceTimer) {
        marketPriceTimer = setInterval(() => {
          void useDashboardStore.getState().syncMarketPrices();
        }, 15 * 60 * 1000);
      }
    } catch (e: any) {
      set({ error: e?.response?.data?.message ?? 'Unable to load dashboard' });
    } finally {
      set({ loading: false });
    }
  },
  syncMarketPrices: async (snapshot?: any) => {
    const current = snapshot ?? useDashboardStore.getState().data;
    const symbols = stockSymbols(current);
    if (!symbols.length) return;
    try {
      const response = await dashboardApi.marketPrices(symbols);
      if (response.data?.ok === false) return;
      const prices = (response.data?.data ?? []).reduce(
        (acc: Record<string, MarketPrice>, quote: MarketPrice) => {
          const symbol = String(quote.symbol ?? '').trim().toUpperCase();
          if (symbol && Number.isFinite(Number(quote.price)))
            acc[symbol] = { ...quote, symbol, price: Number(quote.price) };
          return acc;
        },
        {}
      );
      if (!Object.keys(prices).length) return;
      set(state => ({
        marketPrices: { ...state.marketPrices, ...prices },
        data: mergeMarketPrices(state.data, prices),
      }));
    } catch (error) {
      console.error('[FE_MARKET_PRICE_SYNC]', error);
    }
  },
  clear: () => {
    if (marketPriceTimer) {
      clearInterval(marketPriceTimer);
      marketPriceTimer = null;
    }
    set({ data: null, marketPrices: {}, loading: false, error: null });
  },
}));
