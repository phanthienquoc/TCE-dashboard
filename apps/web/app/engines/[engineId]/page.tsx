'use client';

import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
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
    } catch {
      setConfig(engine.defaults);
    }
  }, [engine]);

  if (!engine) return <main className="min-h-svh bg-[#090510] p-5 text-white"><p>Engine not found.</p></main>;

  function update(key: string, value: string | number | boolean) {
    setConfig((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function save() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[engine.id] = config;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  return (
    <main className="min-h-svh overflow-x-clip bg-[#090510] text-[#f4effa]">
      <header className="sticky top-0 z-40 border-b border-violet-200/[0.08] bg-[#0b0611]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/engines" className="grid size-9 place-items-center rounded-full border border-violet-200/[0.08] text-[#a88bb5] hover:text-white" aria-label="Back to engines">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0"><p className="text-[10px] uppercase tracking-[.14em] text-[#9d8fa8]">{engine.platform} · {engine.category}</p><p className="truncate text-sm font-semibold">{engine.name}</p></div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-12 pt-5 sm:px-6 sm:pt-7">
        <div className="mb-5"><h1 className="text-2xl font-semibold tracking-[-.035em]">Engine detail</h1><p className="mt-2 text-sm leading-6 text-[#81748a]">{engine.description}</p></div>
        <Card><CardContent className="space-y-5 p-5">
          {Object.entries(config).map(([key, value]) => (
            <label key={key} className="block">
              <span className="mb-2 block text-xs font-medium text-[#a99bae]">{labelize(key)}</span>
              {typeof value === 'boolean' ? (
                <button type="button" role="switch" aria-checked={value} onClick={() => update(key, !value)} className={`relative h-7 w-12 rounded-full p-1 transition ${value ? 'bg-emerald-500/80' : 'bg-white/10'}`}>
                  <span className={`block size-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
                </button>
              ) : (
                <input type="number" value={String(value)} onChange={(event) => update(key, Number(event.target.value))} className="h-11 w-full rounded-xl border border-violet-200/[0.08] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-violet-300/30" />
              )}
            </label>
          ))}
          <div className="flex items-center justify-end gap-3 border-t border-violet-200/[0.07] pt-5">
            {saved && <span className="text-xs text-emerald-300">Saved</span>}
            <Button onClick={save}><Save className="size-4" /> Save configuration</Button>
          </div>
        </CardContent></Card>
      </div>
    </main>
  );
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}
