'use client';

import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { getEngine } from '../engine-registry';

const STORAGE_KEY = 'tce-engine-config';

export default function EngineDetailPage() {
  const params = useParams<{ engineId: string }>();
  const engine = useMemo(() => getEngine(params.engineId), [params.engineId]);
  const [config, setConfig] = useState<Record<string, string | number | boolean>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!engine) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      setConfig({ ...engine.defaults, ...(all[engine.id] ?? {}) });
    } catch { setConfig(engine.defaults); }
  }, [engine]);

  if (!engine) return <main className="app-shell"><div className="app-container app-content"><Card className="panel-card p-5">Engine not found.</Card></div></main>;
  const engineId = engine.id;

  function update(key: string, value: string | number | boolean) { setConfig((current) => ({ ...current, [key]: value })); setSaved(false); }
  function save() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[engineId] = config;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      setSaved(true);
    } catch { setSaved(false); }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-container app-header-inner">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/engines" className="touch-target grid place-items-center rounded-2xl border border-violet-200/[0.09] bg-white/[0.02] text-[#a88bb5]" aria-label="Back to engines"><ArrowLeft className="size-4" /></Link>
            <div className="min-w-0"><p className="eyebrow">{engine.platform} · {engine.category}</p><p className="account-email">{engine.name}</p></div>
          </div>
        </div>
      </header>
      <div className="app-container app-content">
        <div className="page-heading"><div className="min-w-0"><p className="eyebrow">Configuration</p><h1>Engine detail</h1><p className="page-subtitle">{engine.description}</p></div></div>
        <Card className="panel-card"><CardContent className="space-y-5 p-5 sm:p-6">
          {Object.entries(config).map(([key, value]) => (
            <label key={key} className="block">
              <span className="mb-2 block text-xs font-medium text-[#a99bae]">{labelize(key)}</span>
              {typeof value === 'boolean' ? (
                <button type="button" role="switch" aria-checked={value} onClick={() => update(key, !value)} className={`relative h-8 w-14 rounded-full p-1 transition ${value ? 'bg-emerald-500/80' : 'bg-white/10'}`}><span className={`block size-6 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : ''}`} /></button>
              ) : (
                <input type="number" value={String(value)} onChange={(event) => update(key, Number(event.target.value))} className="h-12 w-full rounded-xl border border-violet-200/[0.08] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-violet-300/30" />
              )}
            </label>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-violet-200/[0.07] pt-5">
            {saved ? <span className="text-xs text-emerald-300">Saved locally</span> : <span className="text-xs text-[#75697d]">Changes stay on this device.</span>}
            <Button className="touch-target" onClick={save}><Save className="size-4" /> Save</Button>
          </div>
        </CardContent></Card>
      </div>
    </main>
  );
}

function labelize(value: string) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()); }
