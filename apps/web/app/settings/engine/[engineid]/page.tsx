'use client';

import { useParams } from 'next/navigation';
import { ChevronLeft, Power } from 'lucide-react';
import Link from 'next/link';
import DashboardShell from '../../../../components/dashboard/DashboardShell';
import { dashboardApi } from '../../../../lib/api';
import { getEngine, type EngineId } from '../../../engines/engine-registry';
import { useEffect, useState } from 'react';

type EngineStatusRow = {
  engineId?: string;
  status?: string;
};

export default function EngineSettingsPage() {
  const { engineid } = useParams<{ engineid: string }>();
  const engine = getEngine(engineid);
  const [enabled, setEnabled] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!engine) return;
    void dashboardApi
      .engines()
      .then(({ data }) => {
        const rows = Array.isArray(data) ? (data as EngineStatusRow[]) : [];
        const row = rows.find(item => String(item.engineId) === engine.id);
        if (row) setEnabled(String(row.status).toUpperCase() === 'ACTIVE');
      })
      .catch(() => undefined);
  }, [engine]);

  async function toggle() {
    if (!engine || updating) return;
    setUpdating(true);
    const next = !enabled;
    setEnabled(next);
    try {
      await dashboardApi.setEngineStatus(engine.id as EngineId, next ? 'ACTIVE' : 'INACTIVE');
    } catch {
      setEnabled(!next);
    } finally {
      setUpdating(false);
    }
  }

  if (!engine) {
    return (
      <DashboardShell view="settings">
        {() => (
          <div className="tce-mobile-view">
            <h1 className="text-xl font-semibold">Engine not found</h1>
            <Link href="/settings/engine">Back to Engines</Link>
          </div>
        )}
      </DashboardShell>
    );
  }

  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view space-y-6">
          <header className="px-1 pt-2">
            <Link
              href="/settings/engine"
              className="mb-4 inline-flex items-center gap-1 text-sm text-sky-300"
            >
              <ChevronLeft className="size-4" /> Engines
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {engine.category}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">{engine.name}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">{engine.description}</p>
          </header>
          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Runtime
            </p>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              <button
                type="button"
                onClick={() => void toggle()}
                disabled={updating}
                className="flex min-h-[72px] w-full items-center gap-4 border-b border-white/10 px-4 text-left disabled:opacity-60"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-sky-300">
                  <Power className="size-5" />
                </span>
                <span className="flex-1">
                  <strong className="block text-[16px] text-white">Engine Status</strong>
                  <span className="text-sm text-slate-400">{enabled ? 'Active' : 'Inactive'}</span>
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${enabled ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-slate-400'}`}
                >
                  {enabled ? 'ON' : 'OFF'}
                </span>
              </button>
              {Object.entries(engine.defaults).map(([key, value]) => (
                <div
                  key={key}
                  className="flex min-h-[60px] items-center gap-4 border-b border-white/10 px-4 last:border-b-0"
                >
                  <span className="flex-1 text-sm text-slate-300">{key}</span>
                  <span className="text-sm font-medium text-white">{String(value)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
