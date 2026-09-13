'use client';

import { useRef, useState } from 'react';
import { FileJson, Upload, Wifi, Zap } from 'lucide-react';
import { platformApi } from '../../../lib/api';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { useToast } from '../../ui/toast';
import type { PlatformConfigProps } from './types';

type BinanceCredentials = { apiKey: string; apiSecret: string };
type ApiResult = { ok?: boolean; data?: any; error?: { message?: string; providerCode?: number } };
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
function unwrapApiResult(value: unknown): ApiResult {
  if (!value || typeof value !== 'object') return {};
  const root = value as Record<string, unknown>;
  if ('data' in root && root.data && typeof root.data === 'object') return root.data as ApiResult;
  return root as ApiResult;
}
function errorMessage(error: any) {
  return (
    error?.response?.data?.error?.message ??
    error?.response?.data?.message ??
    error?.message ??
    'Request failed'
  );
}
export default function BinancePlatformConfig({ busy, setBusy }: PlatformConfigProps) {
  const [env, setEnv] = useState<'production' | 'testnet'>('testnet');
  const [credentials, setCredentials] = useState<BinanceCredentials>(initialCredentials);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy('binance');
    try {
      const response = unwrapApiResult(await action());
      if (response.ok === false) throw new Error(response.error?.message ?? 'Request failed');
      toast(success, 'success');
    } catch (error: any) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(null);
    }
  };
  const uploadJson = async (file?: File) => {
    if (!file) return;
    setFileName('');
    try {
      if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json')
        throw new Error('Please select a JSON file');
      const next = credentialsFromJson(JSON.parse(await file.text()));
      if (!next.apiKey || !next.apiSecret)
        throw new Error('JSON must contain Binance API Key and API Secret');
      setCredentials(next);
      setFileName(file.name);
      toast(`Loaded Binance credentials from ${file.name}.`, 'success');
    } catch (error: any) {
      toast(error?.message ?? 'Unable to read credential JSON', 'error');
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
          positionSide: 'BOTH',
        }),
      `XAUUSDT market BUY 0.1 submitted on ${env}.`
    );
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Binance Futures</CardTitle>
            <CardDescription className="mt-0.5">
              Credentials & connection verification
            </CardDescription>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-300/15 bg-emerald-300/[0.04] px-2.5 py-1 text-[11px] text-emerald-200">
            Testnet first
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-xs text-zinc-400">Environment</span>
            <select
              value={env}
              onChange={e => setEnv(e.target.value as 'production' | 'testnet')}
              className="h-10 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white"
            >
              <option value="testnet">Testnet</option>
              <option value="production">Production</option>
            </select>
          </label>
          <div>
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
              className="h-10 whitespace-nowrap"
              disabled={!!busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" /> Import JSON
            </Button>
          </div>
        </div>
        {fileName && (
          <span className="inline-flex max-w-full items-center gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] px-3 py-2 text-xs text-emerald-200">
            <FileJson className="size-4 shrink-0" /> <span className="truncate">{fileName}</span>
          </span>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="mb-1 block text-xs text-zinc-400">API Key</span>
            <Input
              className="h-10"
              value={credentials.apiKey}
              onChange={e => {
                setCredentials({ ...credentials, apiKey: e.target.value });
                setFileName('');
              }}
              type="password"
              autoComplete="new-password"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs text-zinc-400">API Secret</span>
            <Input
              className="h-10"
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
        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          <Button
            className="h-10"
            disabled={!!busy}
            onClick={() => void run(() => platformApi.save('binance', env, credentials), 'Saved')}
          >
            Save
          </Button>
          <Button
            className="h-10"
            variant="outline"
            disabled={!!busy}
            onClick={() => void run(() => platformApi.binanceTest(env), 'Connection OK')}
          >
            <Wifi className="size-4" /> Test connection
          </Button>
          <div className="ml-auto flex min-w-0 items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-2.5 py-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">XAU test order</p>
              <p className="truncate text-[10px] text-zinc-400">0.1 XAUUSDT MARKET BUY</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0 px-3"
              disabled={!!busy}
              onClick={placeXauTestOrder}
              title="Sends a real MARKET order through the configured credentials. Use Testnet first."
            >
              <Zap className="size-4" /> Test
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
