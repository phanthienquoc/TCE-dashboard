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
  refresh: (signal?: AbortSignal) => Promise<void>;
  refreshRuns: (signal?: AbortSignal) => Promise<void>;
  save: () => Promise<void>;
  trigger: () => Promise<void>;
  setConfig: (config: StockSyncConfig | ((current: StockSyncConfig) => StockSyncConfig)) => void;
  setTab: (tab: 'runs' | 'config') => void;
  clearMessage: () => void;
  clear: () => void;
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

let refreshController: AbortController | null = null;
let refreshGeneration = 0;
let runsController: AbortController | null = null;
let runsGeneration = 0;
let accountGeneration = 0;

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

  refreshRuns: async externalSignal => {
    if (externalSignal?.aborted) return;
    runsController?.abort();
    const controller = new AbortController();
    runsController = controller;
    const abortFromCaller = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    if (externalSignal?.aborted) controller.abort();
    const generation = ++runsGeneration;
    try {
      const response = await api.get<StockSyncRun[]>(
        '/stock-events-cron/runs?limit=20&_ts=' + Date.now(),
        { ...noCache, signal: controller.signal }
      );
      if (controller.signal.aborted || generation !== runsGeneration) return;
      set({ runs: Array.isArray(response.data) ? response.data : [] });
    } catch (error) {
      if (
        controller.signal.aborted ||
        isApiRequestCancelled(error) ||
        generation !== runsGeneration
      )
        return;
      throw error;
    } finally {
      externalSignal?.removeEventListener('abort', abortFromCaller);
      if (runsController === controller) runsController = null;
    }
  },

  refresh: async externalSignal => {
    if (externalSignal?.aborted || get().loading) return;
    refreshController?.abort();
    const controller = new AbortController();
    refreshController = controller;
    const abortFromCaller = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    if (externalSignal?.aborted) controller.abort();
    const generation = ++refreshGeneration;
    const currentAccountGeneration = accountGeneration;
    set({ loading: true, message: null });
    try {
      const [settings, telegram] = await Promise.all([
        api.get<StockSyncConfig>('/stock-events-cron/settings?_ts=' + Date.now(), {
          ...noCache,
          signal: controller.signal,
        }),
        api.get<StockSyncTelegramBot[]>('/platform/telegram/bots?_ts=' + Date.now(), {
          ...noCache,
          signal: controller.signal,
        }),
        get().refreshRuns(controller.signal),
      ]);
      if (
        controller.signal.aborted ||
        generation !== refreshGeneration ||
        currentAccountGeneration !== accountGeneration
      ) {
        return;
      }
      set({
        config: { ...defaultConfig, ...settings.data },
        bots: telegram.data ?? [],
        initialized: true,
        loading: false,
      });
    } catch (error) {
      if (
        controller.signal.aborted ||
        isApiRequestCancelled(error) ||
        generation !== refreshGeneration ||
        currentAccountGeneration !== accountGeneration
      ) {
        return;
      }
      set({
        initialized: true,
        loading: false,
        message: normalizeApiError(error, 'Unable to load stock events cron data').message,
      });
    } finally {
      externalSignal?.removeEventListener('abort', abortFromCaller);
      if (generation === refreshGeneration && currentAccountGeneration === accountGeneration) {
        set({ loading: false });
      }
      if (refreshController === controller) refreshController = null;
    }
  },

  setConfig: config =>
    set(state => ({ config: typeof config === 'function' ? config(state.config) : config })),

  setTab: tab => set({ tab }),

  clearMessage: () => set({ message: null }),

  save: async () => {
    const generation = accountGeneration;
    set({ saving: true, message: null });
    try {
      const response = await api.post<StockSyncConfig>('/stock-events-cron/settings', get().config);
      if (generation !== accountGeneration) return;
      set(state => ({
        config: { ...state.config, ...response.data },
        saving: false,
        message: 'Saved',
      }));
      await get().refresh();
      if (generation !== accountGeneration) return;
      set({ message: 'Saved' });
    } catch (error) {
      if (generation !== accountGeneration) return;
      set({
        saving: false,
        message: normalizeApiError(error, 'Unable to save').message,
      });
    } finally {
      if (generation === accountGeneration) set({ saving: false });
    }
  },

  trigger: async () => {
    const generation = accountGeneration;
    set({ triggering: true, message: null });
    try {
      const response = await api.post<StockSyncRun>('/stock-events-cron/trigger', {});
      if (generation !== accountGeneration) return;
      await get()
        .refreshRuns()
        .catch(() => undefined);
      if (generation !== accountGeneration) return;
      set({
        triggering: false,
        message:
          response.data.status === 'RUNNING' ? null : `Sync ${response.data.status.toLowerCase()}`,
        tab: 'runs',
      });
    } catch (error) {
      if (generation !== accountGeneration) return;
      set({
        triggering: false,
        message: normalizeApiError(error, 'Unable to trigger sync').message,
      });
    } finally {
      if (generation === accountGeneration) set({ triggering: false });
    }
  },

  clear: () => {
    accountGeneration += 1;
    refreshGeneration += 1;
    runsGeneration += 1;
    refreshController?.abort();
    refreshController = null;
    runsController?.abort();
    runsController = null;
    set({
      config: { ...defaultConfig },
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
}));
