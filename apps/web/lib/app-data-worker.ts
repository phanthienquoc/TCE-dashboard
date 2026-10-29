'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { create } from 'zustand';
import { api } from './api';
import { isApiRequestCancelled, normalizeApiError } from './api-errors';
import { useStockDividendPoolStore } from './stock-dividend-pool-store';
import { useStockEventStore } from './stock-event-store';
import { useStockSyncStore } from './stock-sync-store';
import { useTCEDataStore } from './tce-data-store';

type WorkerStatus = 'idle' | 'running' | 'completed';
type AppDataWorkerState = {
  status: WorkerStatus;
  total: number;
  completed: number;
  failed: number;
  startedAt: number | null;
  finishedAt: number | null;
  start: (router?: AppRouterInstance) => Promise<void>;
  clear: () => void;
};
type Task = { key: string; run: (signal: AbortSignal) => Promise<unknown> };
let inFlight: Promise<void> | null = null;
let workerController: AbortController | null = null;
let workerVersion = 0;
const ROUTES = ['/overview', '/pools', '/position', '/order', '/engines', '/settings', '/profile'];
const prefetchRoutes = (router?: AppRouterInstance) => {
  if (!router) return;
  for (const href of ROUTES) {
    try {
      router.prefetch(href);
    } catch {}
  }
};
const staticTasks = (): Task[] => [
  { key: 'dashboard.account', run: signal => api.get('/dashboard/account', { signal }) },
  { key: 'dashboard.positions', run: signal => api.get('/dashboard/positions', { signal }) },
  { key: 'dashboard.orders', run: signal => api.get('/dashboard/orders', { signal }) },
  {
    key: 'dashboard.pools',
    run: signal => api.get('/dashboard/pools', { params: { status: 'WATCHING' }, signal }),
  },
  {
    key: 'dashboard.nextPositions',
    run: signal => api.get('/dashboard/next-positions', { signal }),
  },
  { key: 'dashboard.strategy', run: signal => api.get('/dashboard/strategy', { signal }) },
  { key: 'dashboard.sources', run: signal => api.get('/dashboard/sources', { signal }) },
  { key: 'dashboard.dreCampaigns', run: signal => api.get('/dre/dashboard/campaigns', { signal }) },
  { key: 'platform.fastApiConfig', run: signal => api.get('/platform/config/fastapi', { signal }) },
  {
    key: 'platform.binanceXauConfig',
    run: signal => api.get('/tce/engine/binance/config', { signal }),
  },
  {
    key: 'platform.binanceXauPositions',
    run: signal => api.get('/tce/engine/binance/positions', { signal }),
  },
  {
    key: 'platform.binanceXauOrders',
    run: signal => api.get('/tce/engine/binance/orders', { signal }),
  },
  { key: 'systemUpdates.config', run: signal => api.get('/tce/system-updates/config', { signal }) },
  { key: 'systemUpdates.latest', run: signal => api.get('/tce/system-updates/latest', { signal }) },
  { key: 'auth.passkeys', run: signal => api.get('/auth/passkeys', { signal }) },
  {
    key: 'stockEventsCron.settings',
    run: signal => api.get('/stock-events-cron/settings', { signal }),
  },
  {
    key: 'stockEventsCron.runs',
    run: signal => api.get('/stock-events-cron/runs', { params: { limit: 20 }, signal }),
  },
];
async function runWithConcurrency(
  tasks: Task[],
  concurrency: number,
  signal: AbortSignal,
  onDone: (failed: boolean) => void
) {
  let cursor = 0;
  const worker = async () => {
    while (!signal.aborted && cursor < tasks.length) {
      const task = tasks[cursor++];
      try {
        await task.run(signal);
        if (!signal.aborted) onDone(false);
      } catch (error) {
        if (signal.aborted || isApiRequestCancelled(error)) continue;
        const failure = normalizeApiError(error, `Prefetch failed: ${task.key}`);
        console.warn(`[APP_DATA_WORKER] ${task.key} failed`, {
          kind: failure.kind,
          status: failure.status,
          message: failure.message,
        });
        if (!signal.aborted) onDone(true);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}
export const useAppDataWorkerStore = create<AppDataWorkerState>((set, get) => ({
  status: 'idle',
  total: 0,
  completed: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
  start: async router => {
    if (inFlight || get().status === 'running') return inFlight ?? Promise.resolve();
    const tasks = staticTasks();
    const controller = new AbortController();
    workerController = controller;
    const version = ++workerVersion;
    const current = () => !controller.signal.aborted && version === workerVersion;
    set({
      status: 'running',
      total: tasks.length + 4,
      completed: 0,
      failed: 0,
      startedAt: Date.now(),
      finishedAt: null,
    });
    const markDone = (failed: boolean) => {
      if (!current()) return;
      set(state => ({ completed: state.completed + 1, failed: state.failed + (failed ? 1 : 0) }));
    };
    inFlight = (async () => {
      try {
        prefetchRoutes(router);
        const storeTasks: Task[] = [
          { key: 'tce-data', run: () => useTCEDataStore.getState().prefetch() },
          { key: 'stock-events', run: () => useStockEventStore.getState().load(200, false, null) },
          { key: 'dividend-pool', run: () => useStockDividendPoolStore.getState().load() },
          { key: 'stock-sync', run: () => useStockSyncStore.getState().refresh() },
        ];
        await runWithConcurrency([...storeTasks, ...tasks], 4, controller.signal, markDone);
      } finally {
        if (current()) set({ status: 'completed', finishedAt: Date.now() });
        if (workerController === controller) workerController = null;
        if (version === workerVersion) inFlight = null;
      }
    })();
    return inFlight;
  },
  clear: () => {
    workerVersion += 1;
    workerController?.abort();
    workerController = null;
    inFlight = null;
    set({ status: 'idle', total: 0, completed: 0, failed: 0, startedAt: null, finishedAt: null });
  },
}));
export const startAppDataWorker = (router?: AppRouterInstance) =>
  useAppDataWorkerStore.getState().start(router);
