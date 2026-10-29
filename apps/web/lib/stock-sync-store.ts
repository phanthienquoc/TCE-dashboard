'use client';

import { create } from 'zustand';
import { api } from './api';
import { isApiRequestCancelled, normalizeApiError } from './api-errors';

export type StockSyncConfig = {
  enabled: boolean;
  schedule: string;
  timezone: string;
  syncStartDate: string | null;
  syncEndDate: string | null;
  batchSize: number;
  pageSize: number;
  priceSyncEnabled: boolean;
  telegramCredentialId: string | null;
  lastRunAt: string | null;
};

export type StockSyncTelegramBot = {
  id: string;
  environment: string;
  name: string;
  isActive: boolean;
  isPaused: boolean;
};

export type StockSyncProgress = {
  phase: 'EVENTS' | 'SSI_PRICE' | 'COMPLETED' | 'FAILED';
  progressPct: number;
  processedEvents: number;
  estimatedTotalEvents: number | null;
  currentPage: number;
  rowsOnPage: number;
  hasMore: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  symbolsRequested: number;
  symbolsSynced: number;
  pageSize: number;
  updatedAt: string;
};

export type StockSyncRun = {
  id: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
  started_at: string;
  finished_at: string | null;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  symbols_requested: number;
  symbols_synced: number;
  error_message: string | null;
  metadata?: { progress?: StockSyncProgress } | null;
};

type StockSyncState = {
  config: StockSyncConfig;
  bots: StockSyncTelegramBot[];
  runs: StockSyncRun[];
  loading: boolean;
  saving: boolean;
  triggering: boolean;
  message: string | null;
  tab: 'runs' | 'config';
  initialized: boolean;
  refresh: () => Promise<void>;
  refreshRuns: () => Promise<void>;
  save: () => Promise<void>;
  trigger: () => Promise<void>;
  setConfig: (config: StockSyncConfig | ((current: StockSyncConfig) => StockSyncConfig)) => void;
  setTab: (tab: 'runs' | 'config') => void;
  clearMessage: () => void;
};

const defaultConfig: StockSyncConfig = {
  enabled: false,
  schedule: '0 */4 * * *',
  timezone: 'Asia/Ho_Chi_Minh',
  syncStartDate: null,
  syncEndDate: null,
  batchSize: 200,
  pageSize: 10,
  priceSyncEnabled: true,
  telegramCredentialId: null,
  lastRunAt: null,
};

const noCache = {
  headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
};

let readController: AbortController | null = null;
let readVersion = 0;
let mutationVersion = 0;

export const useStockSyncStore = create<StockSyncState>((set, get) => ({
  config: defaultConfig,
  bots: [],
  runs: [],
  loading: false,
  saving: false,
  triggering: false,
  message: null,
  tab: 'runs',
  initialized: false,

  refreshRuns: async () => {
    const controller = readController ?? new AbortController();
    const version = readVersion;
    const response = await api.get<StockSyncRun[]>(
      '/stock-events-cron/runs?limit=20&_ts=' + Date.now(),
      { ...noCache, signal: controller.signal }
    );
    if (controller.signal.aborted || version !== readVersion) return;
    set({ runs: Array.isArray(response.data) ? response.data : [] });
  },

  refresh: async () => {
    if (get().loading) return;
    const controller = new AbortController();
    readController = controller;
    const version = ++readVersion;
    set({ loading: true, message: null });
    try {
      const [settings, telegram, runs] = await Promise.all([
        api.get<StockSyncConfig>('/stock-events-cron/settings?_ts=' + Date.now(), {
          ...noCache,
          signal: controller.signal,
        }),
        api.get<StockSyncTelegramBot[]>('/platform/telegram/bots?_ts=' + Date.now(), {
          ...noCache,
          signal: controller.signal,
        }),
        api.get<StockSyncRun[]>('/stock-events-cron/runs?limit=20&_ts=' + Date.now(), {
          ...noCache,
          signal: controller.signal,
        }),
      ]);
      if (controller.signal.aborted || version !== readVersion) return;
      set({
        config: { ...defaultConfig, ...settings.data },
        bots: telegram.data ?? [],
        runs: Array.isArray(runs.data) ? runs.data : [],
        initialized: true,
        loading: false,
      });
    } catch (error) {
      if (controller.signal.aborted || version !== readVersion) return;
      set({
        initialized: true,
        loading: false,
        message: isApiRequestCancelled(error)
          ? null
          : normalizeApiError(error, 'Unable to load stock events cron data').message,
      });
    } finally {
      if (readController === controller) readController = null;
      if (version === readVersion) set({ loading: false });
    }
  },

  setConfig: config =>
    set(state => ({ config: typeof config === 'function' ? config(state.config) : config })),

  setTab: tab => set({ tab }),

  clearMessage: () => set({ message: null }),

  clear: () => {
    readVersion += 1;
    mutationVersion += 1;
    readController?.abort();
    readController = null;
    set({
      config: defaultConfig,
      bots: [],
      runs: [],
      loading: false,
      saving: false,
      triggering: false,
      message: null,
      tab: 'runs',
      initialized: false,
    });
  },

  save: async () => {
    const version = ++mutationVersion;
    set({ saving: true, message: null });
    try {
      const response = await api.post<StockSyncConfig>('/stock-events-cron/settings', get().config);
      if (version !== mutationVersion) return;
      set(state => ({
        config: { ...state.config, ...response.data },
        saving: false,
        message: 'Saved',
      }));
      await get().refresh();
      if (version === mutationVersion) set({ message: 'Saved' });
    } catch (error) {
      if (version === mutationVersion)
        set({
          saving: false,
          message: normalizeApiError(error, 'Unable to save').message,
        });
    } finally {
      if (version === mutationVersion) set({ saving: false });
    }
  },

  trigger: async () => {
    const version = ++mutationVersion;
    set({ triggering: true, message: null });
    try {
      const response = await api.post<StockSyncRun>('/stock-events-cron/trigger', {});
      if (version !== mutationVersion) return;
      await get()
        .refreshRuns()
        .catch(() => undefined);
      if (version === mutationVersion)
        set({
          triggering: false,
          message:
            response.data.status === 'RUNNING'
              ? null
              : `Sync ${response.data.status.toLowerCase()}`,
          tab: 'runs',
        });
    } catch (error) {
      if (version === mutationVersion)
        set({
          triggering: false,
          message: normalizeApiError(error, 'Unable to trigger sync').message,
        });
    } finally {
      if (version === mutationVersion) set({ triggering: false });
    }
  },
}));
