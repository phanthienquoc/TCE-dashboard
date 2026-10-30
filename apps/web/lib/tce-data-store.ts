'use client';

import { create } from 'zustand';
import { dashboardApi, platformApi } from './api';

type TCEDataState = {
  dashboard: any | null;
  engines: any[] | null;
  engineConfig: any | null;
  telegramBots: any[] | null;
  telegramAssignments: any[] | null;
  credentials: any | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  prefetch: () => Promise<void>;
  clear: () => void;
};

let inFlight: Promise<void> | null = null;
let prefetchController: AbortController | null = null;
let prefetchGeneration = 0;

export const useTCEDataStore = create<TCEDataState>((set, get) => ({
  dashboard: null,
  engines: null,
  engineConfig: null,
  telegramBots: null,
  telegramAssignments: null,
  credentials: null,
  loading: false,
  initialized: false,
  error: null,

  prefetch: async () => {
    if (get().initialized) return;
    if (inFlight) return inFlight;

    const controller = new AbortController();
    const generation = ++prefetchGeneration;
    prefetchController = controller;
    set({ loading: true, error: null });

    const request = Promise.allSettled([
      dashboardApi.all('WATCHING', controller.signal),
      dashboardApi.engines(controller.signal),
      dashboardApi.engineConfig(controller.signal),
      platformApi.credentials(controller.signal),
      platformApi.telegramBots(controller.signal),
      platformApi.telegramDebugAssignments(controller.signal),
    ])
      .then(results => {
        if (controller.signal.aborted || generation !== prefetchGeneration) return;

        const [dashboard, engines, engineConfig, credentials, telegramBots, telegramAssignments] =
          results;
        set({
          dashboard: dashboard.status === 'fulfilled' ? dashboard.value.data : null,
          engines: engines.status === 'fulfilled' ? (engines.value.data ?? []) : null,
          engineConfig: engineConfig.status === 'fulfilled' ? engineConfig.value.data : null,
          credentials: credentials.status === 'fulfilled' ? credentials.value.data : null,
          telegramBots:
            telegramBots.status === 'fulfilled'
              ? (telegramBots.value.data?.bots ?? telegramBots.value.data ?? [])
              : null,
          telegramAssignments:
            telegramAssignments.status === 'fulfilled'
              ? Array.isArray(telegramAssignments.value.data)
                ? telegramAssignments.value.data
                : (telegramAssignments.value.data?.assignments ?? [])
              : null,
          initialized: true,
          loading: false,
        });
      })
      .catch(error => {
        if (controller.signal.aborted || generation !== prefetchGeneration) return;
        set({
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to prefetch TCE data',
        });
      })
      .finally(() => {
        if (generation === prefetchGeneration) {
          inFlight = null;
          prefetchController = null;
        }
      });

    inFlight = request;
    return request;
  },

  clear: () => {
    prefetchGeneration += 1;
    prefetchController?.abort();
    prefetchController = null;
    inFlight = null;
    set({
      dashboard: null,
      engines: null,
      engineConfig: null,
      telegramBots: null,
      telegramAssignments: null,
      credentials: null,
      initialized: false,
      loading: false,
      error: null,
    });
  },
}));
