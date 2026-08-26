'use client';

import { ChevronRight, Power, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '../../components/ui/card';
import { ENGINE_REGISTRY, EngineId } from './engine-registry';

const STORAGE_KEY = 'tce-engine-enabled';
type EnabledState = Record<EngineId, boolean>;
const initialState: EnabledState = { 'tce-decision': true, 'ssi-execution': true, 'binance-market': true };

export default function EngineControlPanel() {
  const [enabled, setEnabled] = useState<EnabledState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setEnabled({ ...initialState, ...JSON.parse(raw) });
    } catch {
      // Safe defaults.
    } finally { setHydrated(true); }
  }, []);

  function toggle(id: EngineId) {
    const next = { ...enabled, [id]: !enabled[id] };
    setEnabled(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const activeCount = Object.values(enabled).filter(Boolean).length;

  return (
    <section className="space-y-4 pb-4">
      <div className="page-heading !mb-2">
        <div><p className="eyebrow">Runtime</p><h1>Engine Control</h1><p className="page-subtitle">Enable an engine, then open it for deeper configuration.</p></div>
        <div className="hero-status">{activeCount} ACTIVE</div>
      </div>

      <Card className="panel-card overflow-hidden">
        <div className="divide-y divide-violet-200/[0.07]">
          {ENGINE_REGISTRY.map((engine) => (
            <div key={engine.id} className="flex min-h-[82px] items-center gap-3 px-4 py-3 sm:px-5">
              <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${enabled[engine.id] ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.04] text-[#66596e]'}`}><Power className="size-4" /></div>
              <Link href={`/engines/${engine.id}`} className="min-w-0 flex-1 py-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{engine.name}</p><span className="rounded-full border border-violet-200/[0.08] px-2 py-0.5 text-[9px] uppercase tracking-[.1em] text-[#81748a]">{engine.category}</span></div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#75697d]">{engine.description}</p>
              </Link>
              <button type="button" role="switch" aria-checked={enabled[engine.id]} aria-label={`${enabled[engine.id] ? 'Disable' : 'Enable'} ${engine.name}`} disabled={!hydrated} onClick={() => toggle(engine.id)} className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition ${enabled[engine.id] ? 'bg-emerald-500/80' : 'bg-white/10'}`}>
                <span className={`block size-5 rounded-full bg-white shadow transition-transform ${enabled[engine.id] ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <Link href={`/engines/${engine.id}`} aria-label={`Configure ${engine.name}`} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#75697d] hover:bg-white/[0.04] hover:text-white"><ChevronRight className="size-4" /></Link>
            </div>
          ))}
        </div>
      </Card>
      <div className="flex items-start gap-2 px-1 text-xs leading-5 text-[#75697d]"><Settings2 className="mt-0.5 size-3.5 shrink-0" /> Engine switches are persisted locally. Runtime configuration lives inside each engine.</div>
    </section>
  );
}
