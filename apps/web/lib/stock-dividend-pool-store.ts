'use client';

import { create } from 'zustand';
import { api } from './api';
import { isApiRequestCancelled, normalizeApiError } from './api-errors';

export type StockDividendPoolItem = {
  id: string;
  rank: number;
  ticker: string;
  exDividendDate: string;
  exDividendTimestamp: string | null;
  paymentDate: string | null;
  eventContent: string;
  dividendRate: string;
  dividendValue: number;
  price: number | null;
  dividendYieldPct: number;
  score: number;
  daysToExDate: number;
};

type State = {
  items: StockDividendPoolItem[];
  loading: boolean;
  error: string | null;
  load: (month?: string) => Promise<void>;
  clear: () => void;
};

let requestController: AbortController | null = null;
let requestVersion = 0;

export const useStockDividendPoolStore = create<State>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  load: async (month?: string) => {
    if (get().loading) return;
    const controller = new AbortController();
    requestController = controller;
    const version = ++requestVersion;
    set({ loading: true, error: null });
    try {
      const query = new URLSearchParams({ limit: '20' });
      if (month) query.set('month', month);
      const response = await api.get(`/stock-events/pool?${query.toString()}`, { signal: controller.signal });
      if (controller.signal.aborted || version !== requestVersion) return;
      set({ items: Array.isArray(response.data) ? response.data : [], loading: false });
    } catch (error) {
      if (controller.signal.aborted || version !== requestVersion) return;
      set({
        loading: false,
        error: isApiRequestCancelled(error)
          ? null
          : normalizeApiError(error, 'Failed to load stock dividend pool').message,
      });
    } finally {
      if (requestController === controller) requestController = null;
    }
  },
  clear: () => {
    requestVersion += 1;
    requestController?.abort();
    requestController = null;
    set({ items: [], loading: false, error: null });
  },
}));
