'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { create } from 'zustand';
import { api } from './api';
import { useStockDividendPoolStore } from './stock-dividend-pool-store';
import { useStockEventStore } from './stock-event-store';
import { useStockSyncStore } from './stock-sync-store';
import { useTCEDataStore } from './tce-data-store';

type WorkerStatus = 'idle' | 'running' | 'completed';
type AppDataWorkerState = { status: WorkerStatus; total: number; completed: number; failed: number; startedAt: number | null; finishedAt: number | null; start: (router?: AppRouterInstance) => Promise<void>; clear: () => void };
type Task = { key: string; run: () => Promise<unknown> };
let inFlight: Promise<void> | null = null;
const ROUTES = ['/overview', '/pools', '/position', '/order', '/engines', '/settings', '/profile'];
const prefetchRoutes = (router?: AppRouterInstance) => { if (!router) return; for (const href of ROUTES) { try { router.prefetch(href); } catch {} } };
const staticTasks = (): Task[] => [
  { key: 'dashboard.account', run: () => api.get('/dashboard/account') },
  { key: 'dashboard.positions', run: () => api.get('/dashboard/positions') },
  { key: 'dashboard.orders', run: () => api.get('/dashboard/orders') },
  { key: 'dashboard.pools', run: () => api.get('/dashboard/pools', { params: { status: 'WATCHING' } }) },
  { key: 'dashboard.nextPositions', run: () => api.get('/dashboard/next-positions') },
  { key: 'dashboard.strategy', run: () => api.get('/dashboard/strategy') },
  { key: 'dashboard.sources', run: () => api.get('/dashboard/sources') },
  { key: 'dashboard.dreCampaigns', run: () => api.get('/dre/dashboard/campaigns') },
  { key: 'platform.fastApiConfig', run: () => api.get('/platform/config/fastapi') },
  { key: 'platform.binanceXauConfig', run: () => api.get('/tce/engine/binance/config') },
  { key: 'platform.binanceXauPositions', run: () => api.get('/tce/engine/binance/positions') },
  { key: 'platform.binanceXauOrders', run: () => api.get('/tce/engine/binance/orders') },
  { key: 'systemUpdates.config', run: () => api.get('/tce/system-updates/config') },
  { key: 'systemUpdates.latest', run: () => api.get('/tce/system-updates/latest') },
  { key: 'auth.passkeys', run: () => api.get('/auth/passkeys') },
  { key: 'stockEventsCron.settings', run: () => api.get('/stock-events-cron/settings') },
  { key: 'stockEventsCron.runs', run: () => api.get('/stock-events-cron/runs', { params: { limit: 20 } }) },
];
async function runWithConcurrency(tasks: Task[], concurrency: number, onDone: (failed: boolean) => void) { let cursor = 0; const worker = async () => { while (cursor < tasks.length) { const task = tasks[cursor++]; try { await task.run(); onDone(false); } catch (error) { console.warn(`[APP_DATA_WORKER] ${task.key} failed`, error); onDone(true); } } }; await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker)); }
export const useAppDataWorkerStore = create<AppDataWorkerState>((set, get) => ({
  status: 'idle', total: 0, completed: 0, failed: 0, startedAt: null, finishedAt: null,
  start: async router => { if (inFlight || get().status === 'running') return inFlight ?? Promise.resolve(); const tasks = staticTasks(); set({ status: 'running', total: tasks.length + 4, completed: 0, failed: 0, startedAt: Date.now(), finishedAt: null }); const markDone = (failed: boolean) => set(state => ({ completed: state.completed + 1, failed: state.failed + (failed ? 1 : 0) })); inFlight = (async () => { try { prefetchRoutes(router); const storeTasks: Task[] = [{ key: 'tce-data', run: () => useTCEDataStore.getState().prefetch() }, { key: 'stock-events', run: () => useStockEventStore.getState().load(200, false, null) }, { key: 'dividend-pool', run: () => useStockDividendPoolStore.getState().load() }, { key: 'stock-sync', run: () => useStockSyncStore.getState().refresh() }]; await runWithConcurrency([...storeTasks, ...tasks], 4, markDone); } finally { set({ status: 'completed', finishedAt: Date.now() }); inFlight = null; } })(); return inFlight; },
  clear: () => set({ status: 'idle', total: 0, completed: 0, failed: 0, startedAt: null, finishedAt: null }),
}));
export const startAppDataWorker = (router?: AppRouterInstance) => useAppDataWorkerStore.getState().start(router);
