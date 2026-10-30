import { dashboardApi } from './api';

export type EngineControlState = {
  engineId: string;
  status: string;
};

export type EngineControlConfig = {
  engineId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  updatedAt?: string | null;
};

/** Load the read-only Engine Control snapshot within the owning effect's lifecycle. */
export async function loadEngineControlData(signal: AbortSignal): Promise<{
  states: EngineControlState[];
  configs: EngineControlConfig[];
}> {
  const [stateResponse, configResponse] = await Promise.all([
    dashboardApi.engines(signal),
    dashboardApi.engineConfig(signal),
  ]);

  return {
    states: (stateResponse.data ?? []) as EngineControlState[],
    configs: (configResponse.data ?? []) as EngineControlConfig[],
  };
}
