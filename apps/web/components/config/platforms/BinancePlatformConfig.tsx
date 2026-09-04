'use client';

import { useRef, useState } from 'react';
import { FileJson, Upload, Wifi, Zap } from 'lucide-react';
import { platformApi } from '../../../lib/api';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import type { PlatformConfigProps } from './types';

type BinanceCredentials = { apiKey: string; apiSecret: string };

const initialCredentials: BinanceCredentials = { apiKey: '', apiSecret: '' };

const pick = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
};

function credentialsFromJson(value: unknown): BinanceCredentials {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('JSON root must be an object');
  const root = value as Record<string, unknown>;
  const nested =
    root.credentials && typeof root.credentials === 'object' && !Array.isArray(root.credentials)
      ? (root.credentials as Record<string, unknown>)
      : {};
  const source = { ...root, ...nested };
  return {
    apiKey: pick(source, 'apiKey', 'api_key', 'API_KEY', 'key'),
    apiSecret: pick(source, 'apiSecret', 'api_secret', 'API_SECRET', 'secret'),
  };
}

export default function BinancePlatformConfig({ busy, setBusy }: PlatformConfigProps) {
  const [env, setEnv] = useState<'production' | 'testnet'>('testnet');
  const [credentials, setCredentials] = useState<BinanceCredentials>(initialCredentials);
  const [status, setStatus] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadJson = async (file?: File) => {
    if (!file) return;
    setStatus('');
    setFileName('');
    try {
      if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json')
        throw new Error('Please select a JSON file');
      const parsed = JSON.parse(await file.text());
      const next = credentialsFromJson(parsed);
      if (!next.apiKey || !next.apiSecret)
        throw new Error('JSON must contain Binance API Key and API Secret');
      setCredentials(next);
      setFileName(file.name);
      setStatus(`Loaded Binance credentials from ${file.name}. Review them, then test connection.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to read credential JSON');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const placeXauTestOrder = () =>
    void run(
      () =>
        platformApi.binanceOrder({
          environment: env,
          symbol: 'XAUUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: 0.1,
        }),
      `XAUUSDT market BUY 0.1 submitted on ${env}.`
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Binance Futures</CardTitle>
        <CardDescription>Import credentials like SSI, then verify before saving.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs text-zinc-400">Environment</span>
          <select
            value={env}
            onChange={e => setEnv(e.target.value as 'production' | 'testnet')}
            className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white"
          >
            <option value="testnet">Testnet</option>
            <option value="production">Production</option>
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={event => void uploadJson(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!!busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" /> Import JSON
          </Button>
          {fileName && (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] px-3 text-xs text-emerald-200">
              <FileJson className="size-4" /> {fileName}
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs text-zinc-400">API Key</span>
            <Input
              value={credentials.apiKey}
              onChange={e => {
                setCredentials({ ...credentials, apiKey: e.target.value });
                setFileName('');
              }}
              type="password"
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-zinc-400">API Secret</span>
            <Input
              value={credentials.apiSecret}
              onChange={e => {
                setCredentials({ ...credentials, apiSecret: e.target.value });
                setFileName('');
              }}
              type="password"
              autoComplete="new-password"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!!busy}
            onClick={() => void run(() => platformApi.save('binance', env, credentials), 'Saved')}
          >
            Save
          </Button>
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() => void run(() => platformApi.binanceTest(env), 'Connection OK')}
          >
            <Wifi className="size-4" /> Test connection
          </Button>
        </div>

        <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
          <div className="mb-3">
            <p className="text-sm font-semibold text-white">XAU Futures test order</p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              Sends a real MARKET order through the configured Binance Futures credentials. Use
              Testnet first.
            </p>
          </div>
          <Button type="button" variant="outline" disabled={!!busy} onClick={placeXauTestOrder}>
            <Zap className="size-4" /> Test order
          </Button>
        </div>

        {status && <p className="text-sm text-zinc-300">{status}</p>}
      </CardContent>
    </Card>
  );
}
