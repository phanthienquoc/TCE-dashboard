'use client';

import { create } from 'zustand';
import { dashboardApi } from './api';
import { isApiRequestCancelled, normalizeApiError } from './api-errors';

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
let requestController: AbortController | null = null;
let requestVersion = 0;

export const useEngineRuntimeStore = create<EngineRuntimeState>(set => ({
  engines: [],
  loading: false,
  initialized: false,
  error: null,

  refresh: async () => {
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;
    const version = ++requestVersion;
    set({ loading: true, error: null });

    inFlight = dashboardApi
      .engineRuntime(controller.signal)
      .then(({ data }) => {
        if (controller.signal.aborted || version !== requestVersion) return;
        set({
          engines: Array.isArray(data?.engines) ? data.engines : [],
          initialized: true,
          loading: false,
        });
      })
      .catch(error => {
        if (controller.signal.aborted || version !== requestVersion) return;
        set({
          initialized: true,
          loading: false,
          error: isApiRequestCancelled(error)
            ? null
            : normalizeApiError(error, 'Unable to load engine runtime').message,
        });
      })
      .finally(() => {
        if (requestController === controller) requestController = null;
        if (version === requestVersion) inFlight = null;
      });

    return inFlight;
  },

  clear: () => {
    requestVersion += 1;
    requestController?.abort();
    requestController = null;
    inFlight = null;
    set({
      engines: [],
      loading: false,
      initialized: false,
      error: null,
    });
  },
}));
