import { create } from 'zustand';
import { dashboardApi } from './api';

export type DailyOhlcv = {
  tradingDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

type OhlcvState = {
  histories: Record<string, DailyOhlcv[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  load: (symbol: string, days?: number) => Promise<void>;
  clear: () => void;
};

export const useDividendOhlcvStore = create<OhlcvState>((set, get) => ({
  histories: {},
  loading: {},
  errors: {},
  load: async (symbol, days = 365) => {
    const normalized = String(symbol).trim().toUpperCase();
    if (!normalized || get().loading[normalized] || get().histories[normalized]) return;
    set(state => ({
      loading: { ...state.loading, [normalized]: true },
      errors: { ...state.errors, [normalized]: null },
    }));
    try {
      const response = await dashboardApi.priceHistory(normalized, days);
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      set(state => ({
        histories: {
          ...state.histories,
          [normalized]: rows.map((row: any) => ({
            tradingDate: String(row.trading_date ?? row.tradingDate),
            open: toNullableNumber(row.open),
            high: toNullableNumber(row.high),
            low: toNullableNumber(row.low),
            close: toNullableNumber(row.close),
            volume: toNullableNumber(row.volume),
          })),
        },
        loading: { ...state.loading, [normalized]: false },
      }));
    } catch (error: any) {
      set(state => ({
        loading: { ...state.loading, [normalized]: false },
        errors: { ...state.errors, [normalized]: error?.response?.data?.message ?? 'Unable to load 1Y candle history' },
      }));
    }
  },
  clear: () => set({ histories: {}, loading: {}, errors: {} }),
}));

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
