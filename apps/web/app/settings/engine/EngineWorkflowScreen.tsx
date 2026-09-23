'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { dashboardApi } from '../../../lib/api';
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
type RuntimeRow = {
  engineId: string;
  configuredEnabled: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  dependencies: string[];
};

export default function EngineWorkflowScreen() {
  const [runtime, setRuntime] = useState<WorkflowEngine[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    try {
      const { data } = await dashboardApi.engineRuntime();
      const rows = (data as { engines?: RuntimeRow[] })?.engines ?? [];
      setRuntime(
        ENGINE_REGISTRY.map(definition => {
          const row = rows.find(item => item.engineId === definition.id);
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
    } finally {
      setLoading(false);
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
      await load();
    } finally {
      setUpdating(null);
    }
  }
  useEffect(() => {
    void load();
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
