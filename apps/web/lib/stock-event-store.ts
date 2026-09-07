'use client';

import { create } from 'zustand';
import { stockEventsApi } from './api';

export type StockEvent = {
  id: string;
  ticker: string;
  exDividendDate: string;
  exDividendTimestamp: string | null;
  eventContent: string;
  dividendRate: string;
  dividendValue: number;
  crawledAt?: string | null;
};

type StockEventState = {
  events: StockEvent[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  load: (limit?: number, force?: boolean) => Promise<void>;
  clear: () => void;
};

let inFlight: Promise<void> | null = null;

export const useStockEventStore = create<StockEventState>((set, get) => ({
  events: [],
  loading: false,
  initialized: false,
  error: null,

  load: async (limit = 200, force = false) => {
    if (get().initialized && !force) return;
    if (inFlight) return inFlight;

    set({ loading: true, error: null });
    inFlight = stockEventsApi
      .upcoming(limit)
      .then(response => {
        const events = Array.isArray(response.data) ? (response.data as StockEvent[]) : [];
        set({ events, initialized: true, loading: false, error: null });
      })
      .catch(error => {
        set({
          loading: false,
          initialized: true,
          error: error instanceof Error ? error.message : 'Unable to load stock events',
        });
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  },

  clear: () => set({ events: [], loading: false, initialized: false, error: null }),
}));
