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
  load: (month?: string, signal?: AbortSignal) => Promise<void>;
};

let activeController: AbortController | null = null;
let requestGeneration = 0;

export const useStockDividendPoolStore = create<State>(set => ({
  items: [],
  loading: false,
  error: null,
  load: async (month?: string, externalSignal?: AbortSignal) => {
    if (externalSignal?.aborted) return;

    activeController?.abort();
    const controller = new AbortController();
    const generation = ++requestGeneration;
    activeController = controller;
    const abortFromCaller = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    if (externalSignal?.aborted) controller.abort();

    set({ loading: true, error: null });
    try {
      const query = new URLSearchParams({ limit: '20' });
      if (month) query.set('month', month);
      const response = await api.get<StockDividendPoolItem[]>(
        `/stock-events/pool?${query.toString()}`,
        { signal: controller.signal }
      );

      if (controller.signal.aborted || generation !== requestGeneration) return;
      set({
        items: Array.isArray(response.data) ? response.data : [],
        loading: false,
        error: null,
      });
    } catch (error) {
      if (generation !== requestGeneration) return;
      if (controller.signal.aborted || isApiRequestCancelled(error)) {
        set({ loading: false });
        return;
      }

      set({
        loading: false,
        error: normalizeApiError(error, 'Failed to load stock dividend pool').message,
      });
    } finally {
      externalSignal?.removeEventListener('abort', abortFromCaller);
      if (generation === requestGeneration) {
        activeController = null;
        if (controller.signal.aborted) set({ loading: false });
      }
    }
  },
}));
