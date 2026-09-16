'use client';

import { create } from 'zustand';
import { api } from './api';

export type StockSyncConfig = {
  enabled: boolean;
  schedule: string;
  timezone: string;
  syncStartDate: string | null;
  syncEndDate: string | null;
  batchSize: number;
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
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  symbolsRequested: number;
  symbolsSynced: number;
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
  schedule: '*/15 * * * *',
  timezone: 'Asia/Ho_Chi_Minh',
  syncStartDate: null,
  syncEndDate: null,
  batchSize: 200,
  priceSyncEnabled: true,
  telegramCredentialId: null,
  lastRunAt: null,
};

const noCache = {
  headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
};

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
    const response = await api.get<StockSyncRun[]>(
      '/stock-events-cron/runs?limit=20&_ts=' + Date.now(),
      noCache,
    );
    set({ runs: Array.isArray(response.data) ? response.data : [] });
  },

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true, message: null });
    try {
      const [settings, telegram] = await Promise.all([
        api.get<StockSyncConfig>('/stock-events-cron/settings?_ts=' + Date.now(), noCache),
        api.get<StockSyncTelegramBot[]>('/platform/telegram/bots?_ts=' + Date.now(), noCache),
        get().refreshRuns(),
      ]);
      set({
        config: { ...defaultConfig, ...settings.data },
        bots: telegram.data ?? [],
        initialized: true,
        loading: false,
      });
    } catch (error) {
      set({
        initialized: true,
        loading: false,
        message: error instanceof Error ? error.message : 'Unable to load stock events cron data',
      });
    }
  },

  setConfig: config =>
    set(state => ({ config: typeof config === 'function' ? config(state.config) : config })),

  setTab: tab => set({ tab }),

  clearMessage: () => set({ message: null }),

  save: async () => {
    set({ saving: true, message: null });
    try {
      const response = await api.post<StockSyncConfig>('/stock-events-cron/settings', get().config);
      set(state => ({
        config: { ...state.config, ...response.data },
        saving: false,
        message: 'Saved',
      }));
      await get().refresh();
      set({ message: 'Saved' });
    } catch (error) {
      set({
        saving: false,
        message: error instanceof Error ? error.message : 'Unable to save',
      });
    }
  },

  trigger: async () => {
    set({ triggering: true, message: null });
    try {
      const response = await api.post<StockSyncRun>('/stock-events-cron/trigger', {});
      await get().refreshRuns().catch(() => undefined);
      set({
        triggering: false,
        message:
          response.data.status === 'RUNNING'
            ? 'Sync started'
            : `Sync ${response.data.status.toLowerCase()}`,
        tab: 'runs',
      });
    } catch (error) {
      set({
        triggering: false,
        message: error instanceof Error ? error.message : 'Unable to trigger sync',
      });
    }
  },
}));
