'use client';

import { useState } from 'react';
import { Wifi } from 'lucide-react';
import { platformApi } from '../../../lib/api';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import type { PlatformConfigProps } from './types';

export default function BinancePlatformConfig({ busy, setBusy }: PlatformConfigProps) {
  const [env, setEnv] = useState<'production' | 'testnet'>('testnet');
  const [credentials, setCredentials] = useState({ apiKey: '', apiSecret: '' });
  const [status, setStatus] = useState('');

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy('binance');
    try {
      await action();
      setStatus(success);
    } catch (error: any) {
      setStatus(error?.response?.data?.message ?? error?.message ?? 'Request failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Binance Futures</CardTitle>
        <CardDescription>Environment is shared by save and connection test.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs text-zinc-400">Environment</span>
          <select value={env} onChange={e => setEnv(e.target.value as 'production' | 'testnet')} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white">
            <option value="testnet">Testnet</option>
            <option value="production">Production</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-xs text-zinc-400">API Key</span><Input value={credentials.apiKey} onChange={e => setCredentials({ ...credentials, apiKey: e.target.value })} type="password" autoComplete="new-password" /></label>
          <label className="block"><span className="mb-1.5 block text-xs text-zinc-400">API Secret</span><Input value={credentials.apiSecret} onChange={e => setCredentials({ ...credentials, apiSecret: e.target.value })} type="password" autoComplete="new-password" /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!!busy} onClick={() => void run(() => platformApi.save('binance', env, credentials), 'Saved')}>
            Save
          </Button>
          <Button variant="outline" disabled={!!busy} onClick={() => void run(() => platformApi.binanceTest(env), 'Connection OK')}>
            <Wifi className="size-4" /> Test connection
          </Button>
        </div>
        {status && <p className="text-sm text-zinc-300">{status}</p>}
      </CardContent>
    </Card>
  );
}
