'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Power, Settings2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { dashboardApi } from '../../lib/api';
import { ENGINE_REGISTRY, type EngineDefinition, type EngineId } from './engine-registry';

type EnabledState = Record<EngineId, boolean>;
type RemoteEngine = { engineId: string; status: string; updatedAt?: string | null };

export default function EngineControlPanel() {
  const [engines, setEngines] = useState<EngineDefinition[]>(ENGINE_REGISTRY);
  const [enabled, setEnabled] = useState<EnabledState>({ 'tce-decision': true, 'ssi-execution': true, 'binance-market': true });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<EngineId | null>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([dashboardApi.engines(), dashboardApi.engineConfig()]).then(([engineResponse, configResponse]) => {
      if (!mounted) return;
      const rows = (engineResponse.data ?? []) as RemoteEngine[];
      const byId = new Map(rows.map((row) => [row.engineId, row]));
      setEngines(ENGINE_REGISTRY.filter((engine) => byId.has(engine.id)));
      const next = { 'tce-decision': true, 'ssi-execution': true, 'binance-market': true } as EnabledState;
      for (const row of rows) if (row.engineId in next) next[row.engineId as EngineId] = String(row.status).toUpperCase() === 'ACTIVE';
      setEnabled(next);
      void configResponse;
    }).catch(() => undefined).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function toggle(id: EngineId) {
    if (loading || updating) return;
    const nextEnabled = !enabled[id];
    const previous = enabled[id];
    setEnabled((current) => ({ ...current, [id]: nextEnabled }));
    setUpdating(id);
    try { await dashboardApi.setEngineStatus(id, nextEnabled ? 'ACTIVE' : 'INACTIVE'); } catch { setEnabled((current) => ({ ...current, [id]: previous })); } finally { setUpdating(null); }
  }

  const activeCount = Object.values(enabled).filter(Boolean).length;
  return <section className="space-y-4 pb-4">
    <div className="page-heading !mb-2"><div><p className="eyebrow">Runtime</p><h1>Engine Control</h1><p className="page-subtitle">Engine definitions and state are loaded from the backend account configuration.</p></div><div className="hero-status">{activeCount} ACTIVE</div></div>
    <Card className="panel-card overflow-hidden"><div className="divide-y divide-violet-200/[0.07]">
      {engines.map((engine) => <div key={engine.id} className="flex min-h-[82px] items-center gap-3 px-4 py-3 sm:px-5">
        <button type="button" aria-pressed={enabled[engine.id]} aria-label={`${enabled[engine.id] ? 'Disable' : 'Enable'} ${engine.name}`} disabled={loading || updating !== null} onClick={() => void toggle(engine.id)} className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${enabled[engine.id] ? 'bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20' : 'bg-white/[0.04] text-[#66596e] hover:bg-white/[0.08]'} disabled:opacity-50`}><Power className="size-4" /></button>
        <Link href={`/engines/${engine.id}`} className="min-w-0 flex-1 py-1"><div className="flex min-w-0 flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{engine.name}</p><span className="rounded-full border border-violet-200/[0.08] px-2 py-0.5 text-[9px] uppercase tracking-[.1em] text-[#81748a]">{engine.category}</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#75697d]">{engine.description}</p></Link>
        <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-[.12em] ${enabled[engine.id] ? 'text-emerald-300' : 'text-[#66596e]'}`}>{enabled[engine.id] ? 'ACTIVE' : 'INACTIVE'}</span><Link href={`/engines/${engine.id}`} aria-label={`Configure ${engine.name}`} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#75697d] hover:bg-white/[0.04] hover:text-white"><ChevronRight className="size-4" /></Link>
      </div>)}
    </div></Card>
    <div className="flex items-start gap-2 px-1 text-xs leading-5 text-[#75697d]"><Settings2 className="mt-0.5 size-3.5 shrink-0" /> Runtime state and strategy configuration are persisted per account on the backend.</div>
  </section>;
}
