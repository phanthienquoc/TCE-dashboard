'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, CirclePlus, Pencil, Server, WalletCards, X } from 'lucide-react';
import { platformApi } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import SSIPlatformConfig from './platforms/SSIPlatformConfig';
import BinancePlatformConfig from './platforms/BinancePlatformConfig';
import FastApiPlatformConfig from './platforms/FastApiPlatformConfig';
import type { PlatformConfigProps } from './platforms/types';

type PlatformId = 'ssi' | 'binance' | 'fastapi';
type PlatformRow = { id: PlatformId; label: string; description: string; environment?: string; configured: boolean };

const definitions: Record<PlatformId, Omit<PlatformRow, 'configured'>> = {
  ssi: { id: 'ssi', label: 'SSI FastConnect', description: 'Vietnam equities trading connection' },
  binance: { id: 'binance', label: 'Binance Futures', description: 'Crypto futures trading connection' },
  fastapi: { id: 'fastapi', label: 'FastAPI', description: 'TCE backend service connection' },
};

export default function PlatformConfigTab() {
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<PlatformRow[]>([]);
  const [editing, setEditing] = useState<PlatformId | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [credentialsResult, fastApiResult] = await Promise.allSettled([
        platformApi.credentials(),
        platformApi.fastApiConfig(),
      ]);
      const raw = credentialsResult.status === 'fulfilled' ? credentialsResult.value.data : [];
      const credentials: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
      const find = (provider: PlatformId) => credentials.find(item => String(item?.provider ?? item?.platform ?? '').toLowerCase() === provider);
      const fastApiData = fastApiResult.status === 'fulfilled' ? fastApiResult.value.data : null;
      const ssi = find('ssi');
      const binance = find('binance');
      setRows([
        { ...definitions.ssi, configured: !!ssi, environment: ssi?.environment ?? ssi?.env },
        { ...definitions.binance, configured: !!binance, environment: binance?.environment ?? binance?.env },
        { ...definitions.fastapi, configured: !!(fastApiData?.baseUrl ?? fastApiData?.base_url), environment: fastApiData?.environment ?? 'service' },
      ]);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Unable to load platform configuration');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const closeForm = () => { setEditing(null); setCreating(false); };
  const openCreate = () => { setError(''); setCreating(true); setEditing(null); };
  const openEdit = (id: PlatformId) => { setError(''); setCreating(false); setEditing(id); };
  const selected = editing ? definitions[editing] : null;
  const Form = editing === 'ssi' ? SSIPlatformConfig : editing === 'binance' ? BinancePlatformConfig : editing === 'fastapi' ? FastApiPlatformConfig : null;
  const props: PlatformConfigProps = useMemo(() => ({ busy, setBusy }), [busy]);

  if (creating) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#887b91]">New connection</p><h2 className="mt-1 text-xl font-semibold">Choose a platform</h2><p className="mt-1 text-sm text-zinc-400">Create a connection, then configure its credentials.</p></div>
          <Button variant="ghost" size="icon" onClick={closeForm} aria-label="Close"><X className="size-4" /></Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(definitions) as PlatformId[]).map(id => {
            const item = definitions[id];
            return <Card key={id} className="cursor-pointer border-white/10 transition hover:border-violet-400/40" onClick={() => openEdit(id)}><CardHeader className="pb-3"><div className="mb-1 grid size-9 place-items-center rounded-xl bg-violet-500/10 text-violet-300">{id === 'ssi' ? <WalletCards className="size-4" /> : <Server className="size-4" />}</div><CardTitle className="text-sm">{item.label}</CardTitle><CardDescription>{item.description}</CardDescription></CardHeader><CardContent className="pt-0 text-xs text-zinc-500">Configure <ChevronRight className="ml-1 inline size-3" /></CardContent></Card>;
          })}
        </div>
      </div>
    );
  }

  if (editing && Form && selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#887b91]">Platform configuration</p><h2 className="mt-1 text-xl font-semibold">{selected.label}</h2><p className="mt-1 text-sm text-zinc-400">{selected.description}</p></div><Button variant="ghost" size="icon" onClick={closeForm} aria-label="Back to connections"><X className="size-4" /></Button></div>
        <Form {...props} />
        <div className="flex justify-end"><Button variant="ghost" onClick={() => { closeForm(); void load(); }}>Back to list</Button></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#887b91]">Platform configuration</p><h2 className="mt-1 text-xl font-semibold">Connections</h2><p className="mt-1 text-sm text-zinc-400">Manage trading and service connections from one list.</p></div><Button onClick={openCreate}><CirclePlus className="size-4" /> Add connection</Button></div>
      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/[0.06] px-3 py-2 text-sm text-red-200">{error}</div>}
      <Card className="overflow-hidden border-white/10"><CardContent className="p-0">{rows.map((row, index) => <div key={row.id} className={`flex min-h-[78px] items-center gap-3 px-4 py-3 sm:px-5 ${index ? 'border-t border-white/[0.07]' : ''}`}><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300">{row.id === 'ssi' ? <WalletCards className="size-4" /> : <Server className="size-4" />}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-white">{row.label}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${row.configured ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.06] text-zinc-500'}`}>{row.configured ? 'Configured' : 'Not configured'}</span></div><p className="mt-1 truncate text-xs text-zinc-500">{row.environment ?? row.description}</p></div><Button variant="ghost" size="sm" onClick={() => openEdit(row.id)}><Pencil className="size-3.5" /> Edit</Button><ChevronRight className="hidden size-4 text-zinc-600 sm:block" /></div>)}</CardContent></Card>
    </div>
  );
}
