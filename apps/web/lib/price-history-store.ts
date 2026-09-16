import { create } from 'zustand';
import { dashboardApi } from './api';

export type PriceHistoryPoint = { date: string; price: number };

type PriceHistoryState = {
  histories: Record<string, PriceHistoryPoint[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  load: (symbol: string, days?: number) => Promise<void>;
  clear: () => void;
};

export const usePriceHistoryStore = create<PriceHistoryState>((set, get) => ({
  histories: {},
  loading: {},
  errors: {},
  load: async (symbol, days = 365) => {
    const normalized = String(symbol).trim().toUpperCase();
    if (!normalized) return;
    if (get().loading[normalized]) return;
    if (get().histories[normalized]?.length) return;

    set(state => ({
      loading: { ...state.loading, [normalized]: true },
      errors: { ...state.errors, [normalized]: null },
    }));

    try {
      const response = await dashboardApi.priceHistory(normalized, days);
      const points = Array.isArray(response.data?.data) ? response.data.data : [];
      set(state => ({
        histories: { ...state.histories, [normalized]: points },
        loading: { ...state.loading, [normalized]: false },
      }));
    } catch (error: any) {
      set(state => ({
        loading: { ...state.loading, [normalized]: false },
        errors: {
          ...state.errors,
          [normalized]: error?.response?.data?.message ?? 'Unable to load 1Y price history',
        },
      }));
    }
  },
  clear: () => set({ histories: {}, loading: {}, errors: {} }),
}));
