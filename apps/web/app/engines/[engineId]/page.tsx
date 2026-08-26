'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { getEngine } from '../engine-registry';
import { platformApi } from '../../../lib/api';

const STORAGE_KEY = 'tce-engine-config';
type ActionResult = { ok: boolean; message: string } | null;

export default function EngineDetailPage() {
  const params = useParams<{ engineId: string }>();
  const engine = useMemo(() => getEngine(params.engineId), [params.engineId]);
  const [config, setConfig] = useState<Record<string, string | number | boolean>>({});
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<ActionResult>(null);

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

  async function syncMarketData() {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await platformApi.ssiMarketPriceSync();
      const data = response.data;
      if (!data?.ok) {
        setSyncResult({ ok: false, message: data?.error?.message ?? 'SSI market sync failed' });
        return;
      }
      const usersSynced = Number(data?.data?.usersSynced ?? 0);
      const symbolsSynced = Number(data?.data?.symbolsSynced ?? 0);
      setSyncResult({ ok: true, message: `Synced ${symbolsSynced} symbols across ${usersSynced} account(s).` });
    } catch (error) {
      const value = error as { response?: { data?: { message?: string; error?: { message?: string } } }; message?: string };
      setSyncResult({ ok: false, message: value?.response?.data?.error?.message ?? value?.response?.data?.message ?? value?.message ?? 'SSI market sync failed' });
    } finally {
      setSyncing(false);
    }
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
        {engineId === 'ssi-execution' && (
          <Card className="panel-card mb-4"><CardContent className="space-y-3 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-semibold">Market data</p><p className="mt-1 text-xs leading-5 text-[#75697d]">Trigger the SSI market-price sync manually without waiting for the hourly scheduler.</p></div>
              <Button className="touch-target shrink-0" disabled={syncing} onClick={() => void syncMarketData()}><RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing…' : 'Sync now'}</Button>
            </div>
            {syncResult && <div className={`rounded-xl border px-3 py-2.5 text-xs ${syncResult.ok ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200' : 'border-red-300/15 bg-red-300/[0.05] text-red-200'}`}>{syncResult.message}</div>}
          </CardContent></Card>
        )}
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
