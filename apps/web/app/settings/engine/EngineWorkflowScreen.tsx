'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { dashboardApi } from '../../../lib/api';
import { ENGINE_REGISTRY, getEngine, type EngineId } from '../../engines/engine-registry';
import { EngineWorkflow, type WorkflowEngine } from '../../engines/EngineWorkflow';

const DEPENDENCIES: Record<string, string[]> = {
  'tce-decision': [],
  'ssi-execution': ['tce-decision'],
  'binance-market': [],
  'binance-xau': ['binance-market'],
};

type RuntimeRow = {
  engineId: string;
  configuredEnabled: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  dependencies: string[];
  blockedBy: string[];
  error: string | null;
};

type RuntimeResponse = { engines?: RuntimeRow[] };

export default function EngineWorkflowScreen() {
  const [runtime, setRuntime] = useState<WorkflowEngine[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await dashboardApi.engineRuntime();
      const rows = ((data as RuntimeResponse)?.engines ?? []) as RuntimeRow[];
      const mapped = ENGINE_REGISTRY.map(definition => {
        const row = rows.find(item => item.engineId === definition.id);
        const status = row?.status ?? 'PAUSED';
        return {
          id: definition.id,
          name: definition.name,
          shortName:
            definition.id === 'ssi-execution'
              ? 'SSI Execution'
              : definition.id === 'binance-market'
                ? 'Binance Market'
                : definition.id === 'binance-xau'
                  ? 'Binance XAU'
                  : 'TCE Decision',
          category: definition.category,
          description: definition.description,
          status,
          enabled: Boolean(row?.configuredEnabled),
          dependencies: row?.dependencies ?? DEPENDENCIES[definition.id] ?? [],
          configSummary: definition.platform,
          href: definition.id === 'binance-xau' ? '/xau' : `/settings/engine/${definition.id}`,
        } satisfies WorkflowEngine;
      });
      setRuntime(mapped);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(id: string) {
    const current = runtime.find(engine => engine.id === id);
    if (!current || updating) return;
    if (!current.enabled) {
      const blockedBy = current.dependencies.filter(dependencyId => {
        const dependency = runtime.find(engine => engine.id === dependencyId);
        return !dependency || dependency.status !== 'ACTIVE';
      });
      if (blockedBy.length) return;
    }

    setUpdating(id);
    try {
      await dashboardApi.setEngineStatus(id, current.enabled ? 'INACTIVE' : 'ACTIVE');
      await load();
    } finally {
      setUpdating(null);
    }
  }

  const runningText = useMemo(() => {
    const active = runtime.filter(item => item.status === 'ACTIVE').length;
    if (loading) return 'Đang tải runtime…';
    return `${active}/${runtime.length} engine đang hoạt động`;
  }, [loading, runtime]);

  return (
    <div className="tce-mobile-view space-y-4 pb-8">
      <header className="px-1 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Engine Runtime</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">TCE Workflow</h1>
            <p className="mt-1 text-sm text-slate-400">{runningText}</p>
          </div>
          <Link href="/settings/engine" className="text-xs font-medium text-sky-300">Danh sách</Link>
        </div>
      </header>

      {loading && !runtime.length ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 text-center text-sm text-slate-400">Loading engine runtime…</div>
      ) : (
        <EngineWorkflow engines={runtime.map(engine => ({ ...engine, onToggle: undefined })) as WorkflowEngine[]} />
      )}

      {updating ? <p className="px-1 text-xs text-slate-500">Đang cập nhật {getEngine(updating as EngineId)?.name ?? updating}…</p> : null}
    </div>
  );
}
