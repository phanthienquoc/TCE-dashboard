import { create } from 'zustand';
import { isApiRequestCancelled, normalizeApiError } from './api-errors';
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
  load: (symbol: string, days?: number, signal?: AbortSignal) => Promise<void>;
  clear: () => void;
};

type ActiveRequest = {
  controller: AbortController;
  generation: number;
};

// A generation fence prevents a late market-history response from restoring cleared data.
const activeRequests = new Map<string, ActiveRequest>();
let nextGeneration = 0;

export const useDividendOhlcvStore = create<OhlcvState>((set, get) => ({
  histories: {},
  loading: {},
  errors: {},
  load: async (symbol, days = 365, externalSignal) => {
    const normalized = String(symbol).trim().toUpperCase();
    if (!normalized || externalSignal?.aborted || get().loading[normalized] || get().histories[normalized])
      return;

    set(state => ({
      loading: { ...state.loading, [normalized]: true },
      errors: { ...state.errors, [normalized]: null },
    }));

    const controller = new AbortController();
    const generation = ++nextGeneration;
    activeRequests.set(normalized, { controller, generation });
    const isCurrent = () => activeRequests.get(normalized)?.generation === generation;
    const abortFromCaller = () => {
      controller.abort();
      if (!isCurrent()) return;
      activeRequests.delete(normalized);
      set(state => ({ loading: { ...state.loading, [normalized]: false } }));
    };
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    if (externalSignal?.aborted) abortFromCaller();

    try {
      const response = await dashboardApi.priceHistory(normalized, days, controller.signal);
      if (controller.signal.aborted || !isCurrent()) return;

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
        errors: { ...state.errors, [normalized]: null },
      }));
    } catch (error: unknown) {
      if (!isCurrent()) return;
      if (controller.signal.aborted || isApiRequestCancelled(error)) {
        set(state => ({ loading: { ...state.loading, [normalized]: false } }));
        return;
      }
      set(state => ({
        loading: { ...state.loading, [normalized]: false },
        errors: {
          ...state.errors,
          [normalized]: normalizeApiError(error, 'Unable to load 1Y candle history').message,
        },
      }));
    } finally {
      externalSignal?.removeEventListener('abort', abortFromCaller);
      if (isCurrent()) {
        activeRequests.delete(normalized);
        if (controller.signal.aborted) {
          set(state => ({ loading: { ...state.loading, [normalized]: false } }));
        }
      }
    }
  },
  clear: () => {
    for (const request of activeRequests.values()) request.controller.abort();
    activeRequests.clear();
    set({ histories: {}, loading: {}, errors: {} });
  },
}));

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
