'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { dashboardApi } from '../../../lib/api';
import { isApiRequestCancelled, normalizeApiError } from '../../../lib/api-errors';
import { loadEngineRuntime, type EngineRuntimeRow } from '../../../lib/engine-runtime-data';
import { EngineRuntimeSkeleton } from '../../../components/ui/page-skeleton';
import { ENGINE_REGISTRY, getEngine, type EngineId } from '../../engines/engine-registry';
import { EngineWorkflow, type WorkflowEngine } from '../../engines/EngineWorkflow';

const DEPENDENCIES: Record<string, string[]> = {
  'tce-decision': [],
  'capital-rotation-decision': [],
  'ssi-execution': ['tce-decision'],
  'binance-market': [],
  'binance-execution': ['binance-market'],
  'binance-derivatives': ['binance-market'],
  'binance-xau': ['binance-derivatives'],
};


export default function EngineWorkflowScreen() {
  const [runtime, setRuntime] = useState<WorkflowEngine[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const loadController = useRef<AbortController | null>(null);
  async function load() {
    if (!mounted.current) return;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setError(null);
    try {
      const rows = await loadEngineRuntime(controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      setRuntime(
        ENGINE_REGISTRY.map(definition => {
          const row = rows.find((item: EngineRuntimeRow) => item.engineId === definition.id);
          return {
            id: definition.id,
            name: definition.name,
            shortName:
              definition.id === 'capital-rotation-decision'
                ? 'Capital Rotation'
                : definition.id === 'ssi-execution'
                  ? 'SSI Execution'
                  : definition.id === 'binance-market'
                    ? 'Binance Market'
                    : definition.id === 'binance-execution'
                      ? 'Binance Execution'
                      : definition.id === 'binance-derivatives'
                        ? 'Binance Derivatives'
                        : definition.id === 'binance-xau'
                          ? 'Binance XAU'
                          : 'TCE Decision',
            category: definition.category,
            description: definition.description,
            status: row?.status ?? 'PAUSED',
            enabled: Boolean(row?.configuredEnabled),
            dependencies: row?.dependencies ?? DEPENDENCIES[definition.id] ?? [],
            configSummary: definition.platform,
            href:
              definition.id === 'binance-xau' || definition.id === 'binance-derivatives'
                ? '/xau'
                : `/settings/engine/${definition.id}`,
            onToggle: toggle,
          } satisfies WorkflowEngine;
        })
      );
    } catch (requestError) {
      if (
        !mounted.current ||
        controller.signal.aborted ||
        isApiRequestCancelled(requestError)
      ) {
        return;
      }
      setError(normalizeApiError(requestError, 'Unable to load engine runtime').message);
    } finally {
      if (mounted.current && !controller.signal.aborted) setLoading(false);
      if (loadController.current === controller) loadController.current = null;
    }
  }
  async function toggle(id: string) {
    const current = runtime.find(engine => engine.id === id);
    if (!current || updating) return;
    if (
      !current.enabled &&
      current.dependencies.some(
        dependencyId => runtime.find(engine => engine.id === dependencyId)?.status !== 'ACTIVE'
      )
    )
      return;
    setUpdating(id);
    try {
      await dashboardApi.setEngineStatus(id, current.enabled ? 'INACTIVE' : 'ACTIVE');
      if (mounted.current) await load();
    } finally {
      if (mounted.current) setUpdating(null);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      loadController.current?.abort();
      loadController.current = null;
    };
  }, []);
  const runningText = useMemo(
    () =>
      loading
        ? 'Đang tải runtime…'
        : `${runtime.filter(item => item.status === 'ACTIVE').length}/${runtime.length} engine đang hoạt động`,
    [loading, runtime]
  );
  return (
    <div className="tce-mobile-view space-y-4 pb-8">
      <header className="px-1 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Engine Runtime
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">TCE Workflow</h1>
            <p className="mt-1 text-sm text-slate-400">{runningText}</p>
          </div>
          <Link href="/settings/engines" className="text-xs font-medium text-sky-300">
            Danh sách
          </Link>
        </div>
      </header>
      {error ? (
        <p role="alert" className="px-1 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      {loading && !runtime.length ? (
        <EngineRuntimeSkeleton />
      ) : (
        <EngineWorkflow engines={runtime} />
      )}
      {updating ? (
        <p className="px-1 text-xs text-slate-500">
          Đang cập nhật {getEngine(updating as EngineId)?.name ?? updating}…
        </p>
      ) : null}
    </div>
  );
}
