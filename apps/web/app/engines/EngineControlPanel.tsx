'use client';
import { ChevronRight, Power, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '../../components/ui/card';
import { dashboardApi } from '../../lib/api';
import { useTCEDataStore } from '../../lib/tce-data-store';
import { ENGINE_REGISTRY, EngineId } from './engine-registry';

type EnabledState = Record<EngineId, boolean>;
type EngineState = { engineId: string; status: string };

export default function EngineControlPanel() {
  const cachedEngines = useTCEDataStore(s => s.engines);
  const [engines, setEngines] = useState(() => ENGINE_REGISTRY);
  const [enabled, setEnabled] = useState<EnabledState>({
    'tce-decision': true,
    'ssi-execution': true,
    'binance-market': true,
    'binance-xau': false,
  });
  const [loading, setLoading] = useState(cachedEngines === null);
  const [updating, setUpdating] = useState<EngineId | null>(null);

  useEffect(() => {
    let mounted = true;
    const apply = (rows: EngineState[]) => {
      const configuredIds = new Set(rows.map(row => row.engineId));
      setEngines(
        ENGINE_REGISTRY.filter(
          engine => configuredIds.has(engine.id) || engine.id === 'binance-xau'
        )
      );
      const next = {
        'tce-decision': true,
        'ssi-execution': true,
        'binance-market': true,
        'binance-xau': false,
      } as EnabledState;
      for (const row of rows)
        if (row.engineId in next)
          next[row.engineId as EngineId] = String(row.status).toUpperCase() === 'ACTIVE';
      setEnabled(next);
      setLoading(false);
    };
    if (cachedEngines !== null) {
      apply(cachedEngines as EngineState[]);
      return () => {
        mounted = false;
      };
    }
    void dashboardApi
      .engines()
      .then(r => {
        if (mounted) apply((r.data ?? []) as EngineState[]);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [cachedEngines]);

  async function toggle(id: EngineId) {
    if (loading || updating) return;
    if (id === 'binance-xau') {
      window.location.href = '/engines/xau';
      return;
    }
    const nextEnabled = !enabled[id];
    const previous = enabled[id];
    setEnabled(current => ({ ...current, [id]: nextEnabled }));
    setUpdating(id);
    try {
      await dashboardApi.setEngineStatus(id, nextEnabled ? 'ACTIVE' : 'INACTIVE');
    } catch {
      setEnabled(current => ({ ...current, [id]: previous }));
    } finally {
      setUpdating(null);
    }
  }

  const activeCount = Object.values(enabled).filter(Boolean).length;
  return (
    <section className="space-y-4 pb-4">
      <div className="page-heading engine-control-heading !mb-2">
        <div>
          <p className="eyebrow">Runtime</p>
          <h1>Engine Control</h1>
          <p className="page-subtitle">
            Engine state is loaded from the backend account configuration.
          </p>
        </div>
        <div className="hero-status">{activeCount} ACTIVE</div>
      </div>
      <Card className="panel-card p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {engines.map(engine => (
            <div
              key={engine.id}
              className="group flex min-h-[170px] flex-col rounded-2xl border border-violet-200/[0.07] bg-white/[0.015] p-4 transition hover:border-violet-200/[0.12] hover:bg-white/[0.03]"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  aria-pressed={enabled[engine.id]}
                  aria-label={`${enabled[engine.id] ? 'Disable' : 'Enable'} ${engine.name}`}
                  disabled={loading || updating !== null}
                  onClick={() => void toggle(engine.id)}
                  className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${enabled[engine.id] ? 'bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20' : 'bg-white/[0.04] text-[#66596e] hover:bg-white/[0.08]'} disabled:opacity-50`}
                >
                  <Power className="size-4" />
                </button>
                <Link
                  href={engine.id === 'binance-xau' ? '/engines/xau' : `/engines/${engine.id}`}
                  aria-label={`Configure ${engine.name}`}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-[#75697d] transition hover:bg-white/[0.04] hover:text-white"
                >
                  <ChevronRight className="size-4" />
                </Link>
              </div>
              <Link
                href={engine.id === 'binance-xau' ? '/engines/xau' : `/engines/${engine.id}`}
                className="mt-4 min-w-0 flex-1"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 text-sm font-semibold leading-5">{engine.name}</p>
                  <span className="shrink-0 rounded-full border border-violet-200/[0.08] px-2 py-0.5 text-[9px] uppercase tracking-[.1em] text-[#81748a]">
                    {engine.category}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#75697d]">
                  {engine.description}
                </p>
              </Link>
              <div className="mt-4 flex items-center justify-between border-t border-violet-200/[0.06] pt-3">
                <span
                  className={`text-[9px] font-semibold uppercase tracking-[.12em] ${enabled[engine.id] ? 'text-emerald-300' : 'text-[#66596e]'}`}
                >
                  {enabled[engine.id] ? 'ACTIVE' : 'INACTIVE'}
                </span>
                <Settings2 className="size-3.5 text-[#75697d]" />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="flex items-start gap-2 px-1 text-xs leading-5 text-[#75697d]">
        <Settings2 className="mt-0.5 size-3.5 shrink-0" />
        Engine state and strategy configuration are persisted per account on the backend.
      </div>
    </section>
  );
}
