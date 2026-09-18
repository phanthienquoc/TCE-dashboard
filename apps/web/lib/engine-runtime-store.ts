'use client';

import { create } from 'zustand';
import { dashboardApi } from './api';

export type EngineRuntimeNode = {
  engineId: string;
  configured: boolean;
  configuredEnabled: boolean;
  persistedStatus: 'ACTIVE' | 'INACTIVE' | null;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  dependencies: string[];
  blockedBy: string[];
  updatedAt: string | null;
  error: string | null;
};

type EngineRuntimeState = {
  engines: EngineRuntimeNode[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clear: () => void;
};

let inFlight: Promise<void> | null = null;

export const useEngineRuntimeStore = create<EngineRuntimeState>((set, get) => ({
  engines: [],
  loading: false,
  initialized: false,
  error: null,

  refresh: async () => {
    if (inFlight) return inFlight;
    set({ loading: true, error: null });

    inFlight = dashboardApi
      .engineRuntime()
      .then(({ data }) => {
        set({
          engines: Array.isArray(data?.engines) ? data.engines : [],
          initialized: true,
          loading: false,
        });
      })
      .catch(error => {
        set({
          initialized: true,
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to load engine runtime',
        });
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  },

  clear: () =>
    set({
      engines: [],
      loading: false,
      initialized: false,
      error: null,
    }),
}));
