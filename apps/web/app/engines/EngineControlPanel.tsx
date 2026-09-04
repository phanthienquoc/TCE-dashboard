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
  const [enabled, setEnabled] = useState<EnabledState>({ 'tce-decision': true, 'ssi-execution': true, 'binance-market': true, 'binance-xau': false });
  const [loading, setLoading] = useState(cachedEngines === null);
  const [updating, setUpdating] = useState<EngineId | null>(null);

  useEffect(() => {
    let mounted = true;
    const apply = (rows: EngineState[]) => {
      const configuredIds = new Set(rows.map(row => row.engineId));
      setEngines(ENGINE_REGISTRY.filter(engine => configuredIds.has(engine.id) || engine.id === 'binance-xau'));
      const next = { 'tce-decision': true, 'ssi-execution': true, 'binance-market': true, 'binance-xau': false } as EnabledState;
      for (const row of rows) if (row.engineId in next) next[row.engineId as EngineId] = String(row.status).toUpperCase() === 'ACTIVE';
      setEnabled(next);
      setLoading(false);
    };
    if (cachedEngines !== null) {
      apply(cachedEngines as EngineState[]);
      return () => { mounted = false; };
    }
    void dashboardApi.engines().then(r => { if (mounted) apply((r.data ?? []) as EngineState[]); }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [cachedEngines]);

  async function toggle(id: EngineId) {
    if (loading || updating) return;
    if (id === 'binance-xau') { window.location.href = '/xau'; return; }
    const nextEnabled = !enabled[id];
    const previous = enabled[id];
    setEnabled(current => ({ ...current, [id]: nextEnabled }));
    setUpdating(id);
    try { await dashboardApi.setEngineStatus(id, nextEnabled ? 'ACTIVE' : 'INACTIVE'); }
    catch { setEnabled(current => ({ ...current, [id]: previous })); }
    finally { setUpdating(null); }
  }

  const activeCount = Object.values(enabled).filter(Boolean).length;
  return (
    <section className="engine-control-section">
      <div className="page-heading engine-control-heading">
        <div className="min-w-0"><p className="eyebrow">Runtime</p><h1>Engine Control</h1><p className="page-subtitle">Engine state is loaded from the backend account configuration.</p></div>
        <div className="hero-status">{activeCount} ACTIVE</div>
      </div>
      <Card className="panel-card engine-list-card">
        <div className="engine-list">
          {engines.map(engine => (
            <div key={engine.id} className="engine-row">
              <button type="button" aria-pressed={enabled[engine.id]} aria-label={`${enabled[engine.id] ? 'Disable' : 'Enable'} ${engine.name}`} disabled={loading || updating !== null} onClick={() => void toggle(engine.id)} className={`engine-power ${enabled[engine.id] ? 'is-active' : ''} disabled:opacity-50`}><Power className="size-4" /></button>
              <Link href={engine.id === 'binance-xau' ? '/xau' : `/engines/${engine.id}`} className="engine-copy">
                <div className="engine-title-row"><p>{engine.name}</p><span>{engine.category}</span></div>
                <p className="engine-description">{engine.description}</p>
              </Link>
              <div className="engine-meta"><span className={enabled[engine.id] ? 'is-active-text' : ''}>{enabled[engine.id] ? 'ACTIVE' : 'INACTIVE'}</span><ChevronRight className="size-4" /></div>
            </div>
          ))}
        </div>
      </Card>
      <div className="engine-note"><Settings2 className="size-3.5 shrink-0" />Engine state and strategy configuration are persisted per account on the backend.</div>
    </section>
  );
}
