import { Injectable } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

export type EngineRuntimeStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';

export type EngineRuntimeNode = {
  engineId: string;
  configured: boolean;
  configuredEnabled: boolean;
  persistedStatus: 'ACTIVE' | 'INACTIVE' | null;
  status: EngineRuntimeStatus;
  dependencies: string[];
  blockedBy: string[];
  updatedAt: string | null;
  error: string | null;
};

export const ENGINE_DEPENDENCIES: Record<string, string[]> = {
  'tce-decision': [],
  'ssi-execution': ['tce-decision'],
  'binance-market': [],
  'binance-xau': ['binance-market'],
};

@Injectable()
export class EngineRuntimeService {
  constructor(private readonly db: SupabaseClientService) {}

  async getRuntime(accountId: string): Promise<{ accountId: string; engines: EngineRuntimeNode[] }> {
    const [{ data: configs, error: configError }, { data: states, error: stateError }] = await Promise.all([
      this.db.db.from('tce_engine_configs').select('engine_id,enabled,updated_at').eq('account_id', accountId),
      this.db.db.from('tce_engine_states').select('engine_id,status,updated_at').eq('account_id', accountId),
    ]);
    if (configError) throw configError;
    if (stateError) throw stateError;

    const configById = new Map((configs ?? []).map((row: any) => [String(row.engine_id), row]));
    const stateById = new Map((states ?? []).map((row: any) => [String(row.engine_id), row]));
    const engineIds = new Set<string>([
      ...Object.keys(ENGINE_DEPENDENCIES),
      ...configById.keys(),
      ...stateById.keys(),
    ]);

    const engines = [...engineIds].sort().map(engineId => {
      const config = configById.get(engineId);
      const state = stateById.get(engineId);
      const dependencies = ENGINE_DEPENDENCIES[engineId] ?? [];
      const blockedBy = dependencies.filter(dependencyId => {
        const dependency = stateById.get(dependencyId);
        const dependencyConfig = configById.get(dependencyId);
        return !dependencyConfig?.enabled || dependency?.status !== 'ACTIVE';
      });
      const configured = Boolean(config);
      const configuredEnabled = Boolean(config?.enabled);
      let status: EngineRuntimeStatus = 'PAUSED';
      let error: string | null = null;

      if (configuredEnabled && state?.status === 'ACTIVE') {
        if (blockedBy.length) {
          status = 'ERROR';
          error = `Dependency not ready: ${blockedBy.join(', ')}`;
        } else {
          status = 'ACTIVE';
        }
      } else if (configuredEnabled && !state) {
        status = 'ERROR';
        error = 'Runtime state is missing';
      } else if (configuredEnabled && state?.status === 'INACTIVE') {
        status = 'PAUSED';
      }

      return {
        engineId,
        configured,
        configuredEnabled,
        persistedStatus: state?.status ?? null,
        status,
        dependencies,
        blockedBy,
        updatedAt: state?.updated_at ?? config?.updated_at ?? null,
        error,
      };
    });

    return { accountId, engines };
  }

  async getStartPlan(accountId: string) {
    const runtime = await this.getRuntime(accountId);
    const active = new Set(runtime.engines.filter(engine => engine.status === 'ACTIVE').map(engine => engine.engineId));
    const ordered: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (engineId: string) => {
      if (visited.has(engineId)) return;
      if (visiting.has(engineId)) throw new Error(`Engine dependency cycle detected at ${engineId}`);
      visiting.add(engineId);
      const engine = runtime.engines.find(item => item.engineId === engineId);
      for (const dependency of engine?.dependencies ?? []) visit(dependency);
      visiting.delete(engineId);
      visited.add(engineId);
      if (active.has(engineId)) ordered.push(engineId);
    };

    for (const engine of runtime.engines) visit(engine.engineId);

    return {
      accountId,
      startOrder: ordered,
      startable: runtime.engines.filter(engine => engine.status === 'ACTIVE').map(engine => engine.engineId),
      blocked: runtime.engines.filter(engine => engine.status !== 'ACTIVE').map(engine => ({ engineId: engine.engineId, status: engine.status, blockedBy: engine.blockedBy, error: engine.error })),
    };
  }
}
