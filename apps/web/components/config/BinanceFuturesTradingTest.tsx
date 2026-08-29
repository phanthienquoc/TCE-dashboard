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

type OrderResult = { orderId?: string; symbol?: string; side?: Side; quantity?: number; status?: string; type?: string; triggerPrice?: number };

export default function BinanceFuturesTradingTest() {
  const [environment, setEnvironment] = useState<Environment>('testnet');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [side, setSide] = useState<Side>('BUY');
  const [positionSide, setPositionSide] = useState<PositionSide>('BOTH');
  const [quantity, setQuantity] = useState('0.001');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [allowProduction, setAllowProduction] = useState(false);

  const isProduction = environment === 'production';
  const canTrade = !isProduction || allowProduction;
  const normalizedSymbol = symbol.trim().toUpperCase();
  const amount = Number(quantity);
  const trigger = Number(triggerPrice);

  function errorMessage(error: any) {
    return error?.response?.data?.message ?? error?.response?.data?.error?.message ?? error?.message ?? 'Request failed';
  }

  function validate() {
    if (!normalizedSymbol || !Number.isFinite(amount) || amount <= 0) {
      setResult({ ok: false, message: 'Enter a valid symbol and quantity.' });
      return false;
    }
    if (!canTrade) {
      setResult({ ok: false, message: 'Confirm production trading before sending a real order.' });
      return false;
    }
    return true;
  }

  async function testConnection() {
    setBusy('connection'); setResult(null);
    try {
      const response = await platformApi.binanceTest(environment);
      const data = response.data;
      if (!data?.ok) throw new Error(data?.error?.message ?? 'Binance connection failed');
      setConnected(true);
      const balances = Array.isArray(data.data?.balances) ? data.data.balances : [];
      setResult({ ok: true, message: `Binance Futures ${environment === 'testnet' ? 'Testnet' : 'Production'} connection verified${balances.length ? ` · ${balances.length} balance rows loaded` : ''}.` });
    } catch (error) { setConnected(false); setResult({ ok: false, message: errorMessage(error) }); }
    finally { setBusy(null); }
  }

  async function submit(label: string, request: () => Promise<any>) {
    if (!validate()) return;
    setBusy(label); setResult(null);
    try {
      const response = await request();
      const data = response.data;
      if (!data?.ok) throw new Error(data?.error?.message ?? `${label} order failed`);
      const order: OrderResult = data.data ?? {};
      setResult({ ok: true, message: `${label.toUpperCase()} ${order.symbol ?? normalizedSymbol} · ${order.type ?? 'order'} · ${order.side ?? side} · qty ${order.quantity ?? amount}${order.triggerPrice !== undefined ? ` · trigger ${order.triggerPrice}` : ''} · order ${order.orderId ?? '—'} · ${order.status ?? 'submitted'}.` });
    } catch (error) { setResult({ ok: false, message: errorMessage(error) }); }
    finally { setBusy(null); }
  }

  async function openPosition() {
    await submit('entry', () => platformApi.binanceOrder({ environment, symbol: normalizedSymbol, side, positionSide, quantity: amount }));
  }

  async function takeProfit() {
    if (!Number.isFinite(trigger) || trigger <= 0) { setResult({ ok: false, message: 'Enter a valid TP trigger price.' }); return; }
    const closeSide: Side = side === 'BUY' ? 'SELL' : 'BUY';
    await submit('tp', () => platformApi.binanceTp({ environment, symbol: normalizedSymbol, side: closeSide, positionSide, quantity: amount, triggerPrice: trigger, reduceOnly: positionSide === 'BOTH' }));
  }

  async function stopLoss() {
    if (!Number.isFinite(trigger) || trigger <= 0) { setResult({ ok: false, message: 'Enter a valid SL trigger price.' }); return; }
    const closeSide: Side = side === 'BUY' ? 'SELL' : 'BUY';
    await submit('sl', () => platformApi.binanceSl({ environment, symbol: normalizedSymbol, side: closeSide, positionSide, quantity: amount, triggerPrice: trigger, reduceOnly: positionSide === 'BOTH' }));
  }

  async function closePosition() {
    const closeSide: Side = side === 'BUY' ? 'SELL' : 'BUY';
    await submit('close', () => platformApi.binanceOrder({ environment, symbol: normalizedSymbol, side: closeSide, positionSide, quantity: amount, reduceOnly: positionSide === 'BOTH' }));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3"><div><CardTitle>Binance Futures · Order test</CardTitle><CardDescription>Test the full Futures order flow: Entry, Take Profit, Stop Loss and Close.</CardDescription></div><span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400">{connected === true ? 'Connected' : connected === false ? 'Connection failed' : 'Not tested'}</span></div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Environment"><select value={environment} onChange={e => { setEnvironment(e.target.value as Environment); setConnected(null); setResult(null); }} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60"><option value="testnet">Testnet · recommended</option><option value="production">Production</option></select></Field>
          <Field label="Symbol"><Input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="BTCUSDT" /></Field>
          <Field label="Entry side"><select value={side} onChange={e => setSide(e.target.value as Side)} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white"><option value="BUY">BUY · Long</option><option value="SELL">SELL · Short</option></select></Field>
          <Field label="Position side"><select value={positionSide} onChange={e => setPositionSide(e.target.value as PositionSide)} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white"><option value="BOTH">BOTH · One-way</option><option value="LONG">LONG · Hedge mode</option><option value="SHORT">SHORT · Hedge mode</option></select></Field>
          <Field label="Quantity"><Input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.001" /></Field>
          <Field label="TP / SL trigger price"><Input inputMode="decimal" value={triggerPrice} onChange={e => setTriggerPrice(e.target.value)} placeholder="e.g. 115000" /></Field>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-3"><p className="mb-2 text-xs font-medium text-[#a99bae]">Order actions</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Button type="button" disabled={!!busy} onClick={() => void openPosition()}>{busy === 'entry' ? <Loader2 className="size-4 animate-spin"/> : <CheckCircle2 className="size-4"/>}Entry</Button><Button type="button" variant="outline" disabled={!!busy} onClick={() => void takeProfit()}>{busy === 'tp' ? <Loader2 className="size-4 animate-spin"/> : <CheckCircle2 className="size-4"/>}Take Profit</Button><Button type="button" variant="outline" disabled={!!busy} onClick={() => void stopLoss()}>{busy === 'sl' ? <Loader2 className="size-4 animate-spin"/> : <AlertTriangle className="size-4"/>}Stop Loss</Button><Button type="button" variant="outline" disabled={!!busy} onClick={() => void closePosition()}>{busy === 'close' ? <Loader2 className="size-4 animate-spin"/> : <XCircle className="size-4"/>}Close</Button></div></div>

        <Button type="button" variant="outline" disabled={!!busy} onClick={() => void testConnection()}>{busy === 'connection' ? <Loader2 className="size-4 animate-spin"/> : <ShieldCheck className="size-4"/>}Test connection</Button>

        {isProduction && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100/80"><input type="checkbox" checked={allowProduction} onChange={e => setAllowProduction(e.target.checked)} className="mt-1 size-4 accent-amber-400"/><span><AlertTriangle className="mr-1 inline size-3.5"/>I understand this sends real Binance Futures orders. I will use a small quantity and manage the test orders immediately.</span></label>}
        {result && <div className={`rounded-xl border px-3 py-2.5 text-xs leading-5 ${result.ok ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200' : 'border-red-300/15 bg-red-300/[0.05] text-red-200'}`}>{result.message}</div>}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-[#a99bae]">{label}</span>{children}</label>; }
