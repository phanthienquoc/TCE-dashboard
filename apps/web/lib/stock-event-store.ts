'use client';

import { create } from 'zustand';
import { api } from './api';

export type StockEvent = {
  id: string;
  ticker: string;
  exDividendDate: string;
  exDividendTimestamp: string | null;
  executionDate: string | null;
  eventContent: string;
  dividendRate: string;
  dividendValue: number;
  price: number | null;
  currentPrice: number | null;
  currentPriceDate: string | null;
  dividendYieldPct: number | null;
  oneYearLow: number | null;
  oneYearHigh: number | null;
  crawledAt?: string | null;
  // Compatibility aliases consumed by legacy dashboard views.
  gdkhqTimestamp?: string | null;
  gdkhq_timestamp?: string | null;
  exDate?: string | null;
};

type StockEventState = {
  events: StockEvent[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  load: (limit?: number, force?: boolean, month?: string | null) => Promise<void>;
  clear: () => void;
};

let inFlight: Promise<void> | null = null;

export const useStockEventStore = create<StockEventState>((set, get) => ({
  events: [],
  loading: false,
  initialized: false,
  error: null,

  // Default to the current calendar month using the event's ex-date (GDKHQ).
  // Pass null explicitly when a caller needs the complete upcoming event feed.
  load: async (limit = 200, force = false, month = currentMonthKey()) => {
    if (get().initialized && !force) return;
    if (inFlight) return inFlight;

    set({ loading: true, error: null });
    inFlight = api
      .get<StockEvent[]>('/stock-events', { params: { limit } })
      .then(response => {
        const rawEvents = Array.isArray(response.data) ? response.data : [];
        const events = rawEvents
          .map(event => ({
            ...event,
            gdkhqTimestamp: event.exDividendTimestamp,
            gdkhq_timestamp: event.exDividendTimestamp,
            exDate: event.exDividendDate,
          }))
          .filter(event => {
            if (!month) return true;
            return eventMonthKey(event) === month;
          })
          .sort((a, b) => eventTimestamp(a) - eventTimestamp(b));

        set({
          events,
          initialized: true,
          loading: false,
          error: null,
        });
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

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function eventMonthKey(event: StockEvent): string | null {
  const date = parseEventDate(event);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function eventTimestamp(event: StockEvent): number {
  return parseEventDate(event)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function parseEventDate(event: StockEvent): Date | null {
  const raw = event.exDividendTimestamp ?? event.exDividendDate ?? event.exDate;
  if (!raw) return null;

  const value = String(raw).trim();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const fallback = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}
