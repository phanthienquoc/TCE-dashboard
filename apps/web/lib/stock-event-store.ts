'use client';

import { create } from 'zustand';
import { api } from './api';
import { isApiRequestCancelled, normalizeApiError } from './api-errors';

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
  gdkhqTimestamp?: string | null;
  gdkhq_timestamp?: string | null;
  exDate?: string | null;
};

type StockEventState = {
  events: StockEvent[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  load: (
    limit?: number,
    force?: boolean,
    month?: string | null,
    signal?: AbortSignal
  ) => Promise<void>;
  clear: () => void;
};

let inFlight: Promise<void> | null = null;
let inFlightKey: string | null = null;
let activeController: AbortController | null = null;
let requestGeneration = 0;

// A cancelled worker should stop waiting even when another caller owns the active read.
function waitForInFlightOrAbort(promise: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.resolve();

  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', finish);
      resolve();
    };

    signal.addEventListener('abort', finish, { once: true });
    promise.then(finish, finish);
  });
}

export const useStockEventStore = create<StockEventState>((set, get) => ({
  events: [],
  loading: false,
  initialized: false,
  error: null,

  load: async (limit = 200, force = false, month = currentMonthKey(), externalSignal) => {
    if (externalSignal?.aborted) return;

    const requestKey = `${limit}:${month ?? '*'}`;
    if (get().initialized && !force) return;

    if (inFlight) {
      const waitingGeneration = requestGeneration;
      const waitingKey = inFlightKey;
      const waitingController = activeController;
      await waitForInFlightOrAbort(inFlight, externalSignal);
      if (externalSignal?.aborted || waitingGeneration !== requestGeneration) return;
      if (waitingKey === requestKey && !waitingController?.signal.aborted) return;
      return get().load(limit, true, month, externalSignal);
    }

    const controller = new AbortController();
    const generation = ++requestGeneration;
    activeController = controller;
    const abortFromCaller = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    if (externalSignal?.aborted) controller.abort();

    set({ loading: true, error: null });
    inFlightKey = requestKey;
    inFlight = api
      .get<StockEvent[]>('/stock-events', { params: { limit }, signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted || generation !== requestGeneration) return;

        const rawEvents = Array.isArray(response.data) ? response.data : [];
        const events = rawEvents
          .map(event => ({
            ...event,
            gdkhqTimestamp: event.exDividendTimestamp,
            gdkhq_timestamp: event.exDividendTimestamp,
            exDate: event.exDividendDate,
          }))
          .filter(event => !month || eventMonthKey(event) === month)
          .sort((a, b) => eventTimestamp(a) - eventTimestamp(b));

        set({ events, initialized: true, loading: false, error: null });
      })
      .catch(error => {
        if (generation !== requestGeneration) return;
        if (controller.signal.aborted || isApiRequestCancelled(error)) {
          set({ loading: false });
          return;
        }

        set({
          loading: false,
          initialized: true,
          error: normalizeApiError(error, 'Unable to load stock events').message,
        });
      })
      .finally(() => {
        externalSignal?.removeEventListener('abort', abortFromCaller);
        if (generation === requestGeneration) {
          inFlight = null;
          inFlightKey = null;
          activeController = null;
          if (controller.signal.aborted) set({ loading: false });
        }
      });

    return inFlight;
  },

  clear: () => {
    requestGeneration += 1;
    activeController?.abort();
    activeController = null;
    inFlight = null;
    inFlightKey = null;
    set({ events: [], loading: false, initialized: false, error: null });
  },
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
