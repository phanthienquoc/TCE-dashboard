import { dashboardApi } from './api';

export type EngineRuntimeRow = {
  engineId: string;
  configuredEnabled: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  dependencies: string[];
};

export async function loadEngineRuntime(signal: AbortSignal): Promise<EngineRuntimeRow[]> {
  const { data } = await dashboardApi.engineRuntime(signal);
  const engines = (data as { engines?: unknown } | null | undefined)?.engines;
  return Array.isArray(engines) ? (engines as EngineRuntimeRow[]) : [];
}
