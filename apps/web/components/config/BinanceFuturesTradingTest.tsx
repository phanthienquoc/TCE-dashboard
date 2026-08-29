'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { platformApi } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';

type Environment = 'production' | 'testnet';
type PositionSide = 'BOTH' | 'LONG' | 'SHORT';
type Side = 'BUY' | 'SELL';
type Result = { ok: boolean; message: string } | null;

export default function BinanceFuturesTradingTest() {
  const [environment, setEnvironment] = useState<Environment>('testnet');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [side, setSide] = useState<Side>('BUY');
  const [positionSide, setPositionSide] = useState<PositionSide>('BOTH');
  const [quantity, setQuantity] = useState('0.001');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [allowProduction, setAllowProduction] = useState(false);

  const isProduction = environment === 'production';
  const canTrade = !isProduction || allowProduction;

  function errorMessage(error: any) {
    return error?.response?.data?.message ?? error?.response?.data?.error?.message ?? error?.message ?? 'Request failed';
  }

  async function testConnection() {
    setBusy('connection');
    setResult(null);
    try {
      const response = await platformApi.binanceTest(environment);
      const data = response.data;
      if (!data?.ok) throw new Error(data?.error?.message ?? 'Binance connection failed');
      setConnected(true);
      const balances = Array.isArray(data.data?.balances) ? data.data.balances : [];
      setResult({ ok: true, message: `Binance Futures ${environment === 'testnet' ? 'Testnet' : 'Production'} connection verified${balances.length ? ` · ${balances.length} balance rows loaded` : ''}.` });
    } catch (error) {
      setConnected(false);
      setResult({ ok: false, message: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function openPosition() {
    const amount = Number(quantity);
    if (!symbol.trim() || !Number.isFinite(amount) || amount <= 0) {
      setResult({ ok: false, message: 'Enter a valid symbol and quantity.' });
      return;
    }
    if (!canTrade) {
      setResult({ ok: false, message: 'Confirm production trading before sending a real order.' });
      return;
    }
    setBusy('open');
    setResult(null);
    try {
      const response = await platformApi.binanceOrder({ environment, symbol: symbol.trim().toUpperCase(), side, positionSide, quantity: amount });
      const data = response.data;
      if (!data?.ok) throw new Error(data?.error?.message ?? 'Unable to open position');
      const order = data.data;
      setResult({ ok: true, message: `OPEN ${order?.symbol ?? symbol.toUpperCase()} ${order?.side ?? side} · qty ${order?.quantity ?? amount} · order ${order?.orderId ?? '—'} · ${order?.status ?? 'submitted'}.` });
    } catch (error) {
      setResult({ ok: false, message: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function closePosition() {
    const amount = Number(quantity);
    if (!symbol.trim() || !Number.isFinite(amount) || amount <= 0) {
      setResult({ ok: false, message: 'Enter a valid symbol and quantity.' });
      return;
    }
    if (!canTrade) {
      setResult({ ok: false, message: 'Confirm production trading before sending a real order.' });
      return;
    }
    setBusy('close');
    setResult(null);
    try {
      const closeSide: Side = side === 'BUY' ? 'SELL' : 'BUY';
      const request: Record<string, unknown> = { environment, symbol: symbol.trim().toUpperCase(), side: closeSide, positionSide, quantity: amount };
      if (positionSide === 'BOTH') request.reduceOnly = true;
      const response = await platformApi.binanceOrder(request);
      const data = response.data;
      if (!data?.ok) throw new Error(data?.error?.message ?? 'Unable to close position');
      const order = data.data;
      const closeMode = positionSide === 'BOTH' ? 'reduce-only' : `hedge ${positionSide}`;
      setResult({ ok: true, message: `CLOSE ${order?.symbol ?? symbol.toUpperCase()} ${order?.side ?? closeSide} · ${closeMode} · qty ${order?.quantity ?? amount} · order ${order?.orderId ?? '—'} · ${order?.status ?? 'submitted'}.` });
    } catch (error) {
      setResult({ ok: false, message: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Binance Futures · Order test</CardTitle>
            <CardDescription>Verify the connected credential, then send a small MARKET open and close order.</CardDescription>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${connected === true ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200' : connected === false ? 'border-red-300/20 bg-red-300/[0.06] text-red-200' : 'border-white/10 bg-white/[0.03] text-zinc-400'}`}>
            {connected === true ? 'Connected' : connected === false ? 'Connection failed' : 'Not tested'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Environment">
            <select value={environment} onChange={event => { setEnvironment(event.target.value as Environment); setConnected(null); setResult(null); }} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60">
              <option value="testnet">Testnet · recommended</option>
              <option value="production">Production</option>
            </select>
          </Field>
          <Field label="Symbol"><Input value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase())} placeholder="BTCUSDT" /></Field>
          <Field label="Entry side">
            <select value={side} onChange={event => setSide(event.target.value as Side)} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60">
              <option value="BUY">BUY · Long</option>
              <option value="SELL">SELL · Short</option>
            </select>
          </Field>
          <Field label="Position side">
            <select value={positionSide} onChange={event => setPositionSide(event.target.value as PositionSide)} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60">
              <option value="BOTH">BOTH · One-way</option>
              <option value="LONG">LONG · Hedge mode</option>
              <option value="SHORT">SHORT · Hedge mode</option>
            </select>
          </Field>
          <Field label="Quantity"><Input inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="0.001" /></Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!!busy} onClick={() => void testConnection()}>{busy === 'connection' ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Test connection</Button>
          <Button type="button" disabled={!!busy || !canTrade} onClick={() => void openPosition()}>{busy === 'open' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Open position</Button>
          <Button type="button" variant="outline" disabled={!!busy || !canTrade} onClick={() => void closePosition()}>{busy === 'close' ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}Close position</Button>
        </div>

        {isProduction && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100/80">
          <input type="checkbox" checked={allowProduction} onChange={event => setAllowProduction(event.target.checked)} className="mt-1 size-4 accent-amber-400" />
          <span><AlertTriangle className="mr-1 inline size-3.5" />I understand this sends a real Binance Futures order. I will use a small quantity and close the test position immediately.</span>
        </label>}

        {result && <div className={`rounded-xl border px-3 py-2.5 text-xs leading-5 ${result.ok ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200' : 'border-red-300/15 bg-red-300/[0.05] text-red-200'}`}>{result.message}</div>}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-medium text-[#a99bae]">{label}</span>{children}</label>;
}
