'use client';

import { create } from 'zustand';
import { api } from './api';

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
  load: () => Promise<void>;
};

export const useStockDividendPoolStore = create<State>(set => ({
  items: [],
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/stock-events/pool?limit=20');
      set({ items: Array.isArray(response.data) ? response.data : [], loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load stock dividend pool',
      });
    }
  },
}));
