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
let inFlightController: AbortController | null = null;
let runtimeGeneration = 0;

export const useEngineRuntimeStore = create<EngineRuntimeState>(set => ({
  engines: [],
  loading: false,
  initialized: false,
  error: null,

  refresh: async () => {
    if (inFlight) return inFlight;

    const generation = runtimeGeneration;
    const controller = new AbortController();
    inFlightController = controller;
    set({ loading: true, error: null });

    const request = Promise.resolve()
      .then(() => dashboardApi.engineRuntime(controller.signal))
      .then(({ data }) => {
        if (controller.signal.aborted || generation !== runtimeGeneration) return;
        set({
          engines: Array.isArray(data?.engines) ? data.engines : [],
          initialized: true,
          loading: false,
          error: null,
        });
      })
      .catch(error => {
        if (generation !== runtimeGeneration) return;
        if (controller.signal.aborted || isApiRequestCancelled(error)) {
          set({ loading: false });
          return;
        }

        set({
          initialized: true,
          loading: false,
          error: normalizeApiError(error, 'Unable to load engine runtime').message,
        });
      })
      .finally(() => {
        if (generation === runtimeGeneration && inFlight === request) {
          inFlight = null;
          inFlightController = null;
        }
      });

    inFlight = request;
    return request;
  },

  clear: () => {
    runtimeGeneration += 1;
    inFlightController?.abort();
    inFlightController = null;
    inFlight = null;
    set({
      engines: [],
      loading: false,
      initialized: false,
      error: null,
    });
  },
}));
