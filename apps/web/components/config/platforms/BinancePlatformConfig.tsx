'use client';
import { useState } from 'react';
import { Wifi } from 'lucide-react';
import { platformApi } from '../../../lib/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import type { PlatformConfigProps } from './types';

export default function BinancePlatformConfig({ busy, setBusy }: PlatformConfigProps) {
  const [env, setEnv] = useState<'production' | 'testnet'>('testnet');
  const [credentials, setCredentials] = useState({ apiKey: '', apiSecret: '' });
  const [status, setStatus] = useState('');
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy('binance');
    try { await action(); setStatus(success); } catch (e: any) { setStatus(e?.response?.data?.message ?? e?.message ?? 'Request failed'); }
    finally { setBusy(null); }
  };
  return <div className="space-y-4">
    <Field label="Environment"><select value={env} onChange={e => setEnv(e.target.value as 'production' | 'testnet')} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white"><option value="testnet">Testnet</option><option value="production">Production</option></select></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="API Key"><Input value={credentials.apiKey} onChange={e => setCredentials(c => ({ ...c, apiKey: e.target.value }))} type="password" autoComplete="new-password" /></Field><Field label="API Secret"><Input value={credentials.apiSecret} onChange={e => setCredentials(c => ({ ...c, apiSecret: e.target.value }))} type="password" autoComplete="new-password" /></Field></div>
    <div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => void run(() => platformApi.save('binance', env, credentials), 'Saved')} >Save</Button><Button variant="outline" disabled={!!busy} onClick={() => void run(() => platformApi.binanceTest(env), 'Connection OK')}><Wifi className="size-4"/> Test connection</Button></div>
    {status && <p className="text-sm text-zinc-300">{status}</p>}
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="block text-xs font-medium text-zinc-300">{label}</span>{children}</label>; }
