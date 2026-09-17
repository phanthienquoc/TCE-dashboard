import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

export type EngineRuntimeStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';
export type EngineExecutionStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'WAITING';
export type EngineStepStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

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
        } else status = 'ACTIVE';
      } else if (configuredEnabled && !state) {
        status = 'ERROR';
        error = 'Runtime state is missing';
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

  async getLatestExecution(accountId: string) {
    const { data: run, error } = await this.db.db
      .from('tce_engine_runs')
      .select('id,workflow_id,status,current_node,started_at,finished_at,error_message,metadata')
      .eq('account_id', accountId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!run) return { run: null, steps: [] };
    return this.getExecution(accountId, String(run.id));
  }

  async getExecution(accountId: string, runId: string) {
    const { data: run, error: runError } = await this.db.db
      .from('tce_engine_runs')
      .select('id,workflow_id,status,current_node,started_at,finished_at,error_message,metadata')
      .eq('account_id', accountId)
      .eq('id', runId)
      .maybeSingle();
    if (runError) throw runError;
    if (!run) throw new NotFoundException('Execution run not found');
    const { data: steps, error: stepError } = await this.db.db
      .from('tce_engine_run_steps')
      .select('id,run_id,engine_id,sequence,status,started_at,finished_at,error_message,metadata')
      .eq('run_id', runId)
      .order('sequence', { ascending: true });
    if (stepError) throw stepError;
    return { run, steps: steps ?? [] };
  }

  async createExecution(accountId: string, workflowId = 'tce-default') {
    const plan = await this.getStartPlan(accountId);
    if (!plan.startOrder.length) throw new BadRequestException('No active engines available for execution');
    const { data: run, error: runError } = await this.db.db
      .from('tce_engine_runs')
      .insert({ account_id: accountId, workflow_id: workflowId, status: 'RUNNING', current_node: plan.startOrder[0] })
      .select('id,workflow_id,status,current_node,started_at,finished_at,error_message,metadata')
      .single();
    if (runError) throw runError;
    const { error: stepError } = await this.db.db.from('tce_engine_run_steps').insert(
      plan.startOrder.map((engineId, sequence) => ({
        run_id: run.id,
        engine_id: engineId,
        sequence,
        status: sequence === 0 ? 'RUNNING' : 'PENDING',
        started_at: sequence === 0 ? new Date().toISOString() : null,
      }))
    );
    if (stepError) throw stepError;
    return this.getExecution(accountId, String(run.id));
  }

  async updateExecutionStep(accountId: string, runId: string, engineId: string, status: EngineStepStatus, errorMessage?: string | null) {
    const execution = await this.getExecution(accountId, runId);
    const step = execution.steps.find(item => String(item.engine_id) === engineId);
    if (!step) throw new NotFoundException(`Execution step not found: ${engineId}`);
    if (status === 'RUNNING' && execution.run.status !== 'RUNNING') throw new BadRequestException('Execution is already finished');

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status };
    if (status === 'RUNNING') patch.started_at = step.started_at ?? now;
    if (status === 'SUCCESS' || status === 'FAILED') patch.finished_at = now;
    if (errorMessage !== undefined) patch.error_message = errorMessage;

    const { error: stepError } = await this.db.db.from('tce_engine_run_steps').update(patch).eq('id', step.id).eq('run_id', runId);
    if (stepError) throw stepError;

    const nextStep = execution.steps.find(item => Number(item.sequence) === Number(step.sequence) + 1);
    if (status === 'SUCCESS' && nextStep) {
      const { error } = await this.db.db.from('tce_engine_run_steps').update({ status: 'RUNNING', started_at: now }).eq('id', nextStep.id).eq('run_id', runId);
      if (error) throw error;
      const { error: runUpdateError } = await this.db.db.from('tce_engine_runs').update({ current_node: nextStep.engine_id, status: 'RUNNING' }).eq('id', runId).eq('account_id', accountId);
      if (runUpdateError) throw runUpdateError;
    } else if (status === 'SUCCESS') {
      const { error } = await this.db.db.from('tce_engine_runs').update({ status: 'SUCCESS', current_node: null, finished_at: now }).eq('id', runId).eq('account_id', accountId);
      if (error) throw error;
    } else if (status === 'FAILED') {
      const { error } = await this.db.db.from('tce_engine_runs').update({ status: 'FAILED', current_node: engineId, finished_at: now, error_message: errorMessage ?? null }).eq('id', runId).eq('account_id', accountId);
      if (error) throw error;
    }
    return this.getExecution(accountId, runId);
  }
}
