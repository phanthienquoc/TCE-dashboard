'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Loader2, Save, ShieldCheck, Wifi } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { platformApi } from '../../lib/api';

type Config = {
  enabled: boolean;
  quantity: number;
  positionSide: 'BOTH' | 'LONG' | 'SHORT';
  xauEnabled: boolean;
  xauSymbol: string;
  autoProtection: boolean;
  tpPct: number;
  slPct: number;
};

type Position = {
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  markPrice: number;
  unrealizedProfit: number;
  positionSide?: string;
};

export default function BinanceXauTradingPanel() {
  const [config, setConfig] = useState<Config>({
    enabled: false,
    quantity: 0.01,
    positionSide: 'BOTH',
    xauEnabled: false,
    xauSymbol: 'XAUUSDT',
    autoProtection: true,
    tpPct: 5,
    slPct: 5,
  });
  const [position, setPosition] = useState<Position | null>(null);
  const [bots, setBots] = useState<any[]>([]);
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [botName, setBotName] = useState('xau-trading');
  const [environment, setEnvironment] = useState<'production' | 'testnet'>('production');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'fallback'>('connecting');

  const baseUrl = useMemo(() => {
    const value = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';
    return value.replace(/\/$/, '');
  }, []);

  async function load() {
    setBusy(true);
    try {
      const [configResponse, botsResponse] = await Promise.all([
        platformApi.binanceXauConfig(),
        platformApi.telegramBots(),
      ]);
      if (configResponse.data) setConfig(current => ({ ...current, ...configResponse.data }));
      const rows = botsResponse.data?.bots ?? botsResponse.data ?? [];
      setBots(Array.isArray(rows) ? rows : []);
      await refreshPosition();
    } finally {
      setBusy(false);
    }
  }

  async function refreshPosition() {
    try {
      const response = await platformApi.binanceXauPositions(environment);
      const rows = Array.isArray(response.data) ? response.data : [];
      setPosition(rows.find((item: Position) => Math.abs(Number(item.positionAmt)) > 0) ?? null);
    } catch {
      setPosition(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    async function connect() {
      setSocketState('connecting');
      try {
        const response = await fetch(`${baseUrl}/tce/engine/binance/ws-token`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${sessionStorage.getItem('tce_access_token') ?? ''}` },
        });
        if (!response.ok) throw new Error('socket token unavailable');
        const data = await response.json();
        if (!data?.listenKey) throw new Error('socket token unavailable');
        const ws = new WebSocket(data.url ?? 'wss://fstream.binance.com/ws');
        ws.onopen = () => setSocketState('connected');
        ws.onmessage = event => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.e === 'ACCOUNT_UPDATE') void refreshPosition();
          } catch {
            // Ignore malformed websocket frames and keep the stream alive.
          }
        };
        ws.onclose = () => {
          if (!closed) {
            setSocketState('fallback');
            timer = setInterval(() => void refreshPosition(), 5000);
          }
        };
        ws.onerror = () => {
          if (!closed) setSocketState('fallback');
        };
        return () => ws.close();
      } catch {
        setSocketState('fallback');
        timer = setInterval(() => void refreshPosition(), 5000);
        return undefined;
      }
    }
    let cleanup: (() => void) | undefined;
    void connect().then(fn => {
      cleanup = fn;
    });
    return () => {
      closed = true;
      cleanup?.();
      if (timer) clearInterval(timer);
    };
  }, [baseUrl, environment]);

  async function saveConfig() {
    setBusy(true);
    setMessage('');
    try {
      const response = await platformApi.saveBinanceXauConfig(config);
      setConfig(current => ({ ...current, ...(response.data ?? {}) }));
      setMessage('Binance XAU engine saved.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message ?? error?.message ?? 'Unable to save Binance XAU config.');
    } finally {
      setBusy(false);
    }
  }

  async function saveTelegramBot() {
    if (!token.trim()) {
      setMessage('Telegram bot token is required.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await platformApi.telegramSave({
        token: token.trim(),
        chatId: chatId.trim() || undefined,
        environment,
        name: botName.trim() || 'xau-trading',
      });
      if (!response.data?.ok) throw new Error(response.data?.message ?? 'Telegram bot setup failed.');
      setToken('');
      setMessage(`Telegram connected: @${response.data.bot?.username ?? response.data.bot?.first_name ?? 'bot'}`);
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message ?? error?.message ?? 'Unable to connect Telegram bot.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="panel-card">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Activity className="size-4" /> Binance Futures · XAU
              </CardTitle>
              <p className="mt-1 text-xs text-zinc-500">Telegram signals → Binance Futures execution</p>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <Wifi className="size-3.5" /> {socketState}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-zinc-400">Environment<select value={environment} onChange={e => setEnvironment(e.target.value as any)} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white"><option value="production">Production</option><option value="testnet">Testnet</option></select></label>
            <label className="text-xs text-zinc-400">Symbol<Input value={config.xauSymbol} onChange={e => setConfig({ ...config, xauSymbol: e.target.value.toUpperCase() })} className="mt-1" /></label>
            <label className="text-xs text-zinc-400">Quantity<Input type="number" step="0.001" min="0" value={config.quantity} onChange={e => setConfig({ ...config, quantity: Number(e.target.value) })} className="mt-1" /></label>
            <label className="text-xs text-zinc-400">Position side<select value={config.positionSide} onChange={e => setConfig({ ...config, positionSide: e.target.value as any })} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white"><option>BOTH</option><option>LONG</option><option>SHORT</option></select></label>
            <label className="text-xs text-zinc-400">Auto TP %<Input type="number" min="0.1" step="0.1" value={config.tpPct} onChange={e => setConfig({ ...config, tpPct: Number(e.target.value) })} className="mt-1" /></label>
            <label className="text-xs text-zinc-400">Auto SL %<Input type="number" min="0.1" step="0.1" value={config.slPct} onChange={e => setConfig({ ...config, slPct: Number(e.target.value) })} className="mt-1" /></label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setConfig({ ...config, enabled: !config.enabled, xauEnabled: !config.xauEnabled })} className={`rounded-xl border px-3 py-2 text-left text-sm ${config.enabled && config.xauEnabled ? 'border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-200' : 'border-white/10 text-zinc-400'}`}>
              <strong>{config.enabled && config.xauEnabled ? 'Engine ACTIVE' : 'Engine INACTIVE'}</strong>
              <span className="mt-0.5 block text-xs opacity-70">One active XAU position per symbol</span>
            </button>
            <button type="button" onClick={() => setConfig({ ...config, autoProtection: !config.autoProtection })} className={`rounded-xl border px-3 py-2 text-left text-sm ${config.autoProtection ? 'border-violet-300/20 bg-violet-300/[0.05] text-violet-200' : 'border-white/10 text-zinc-400'}`}>
              <strong>{config.autoProtection ? 'Auto TP/SL ON' : 'Auto TP/SL OFF'}</strong>
              <span className="mt-0.5 block text-xs opacity-70">Fallback protection uses ± configured percent</span>
            </button>
          </div>
          <Button type="button" disabled={busy} onClick={() => void saveConfig()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save engine</Button>
        </CardContent>
      </Card>

      <Card className="panel-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="size-4" /> Telegram signal bot</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-zinc-400">Bot name<Input value={botName} onChange={e => setBotName(e.target.value)} className="mt-1" /></label>
            <label className="text-xs text-zinc-400">Bot token<Input type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="new-password" className="mt-1" /></label>
            <label className="text-xs text-zinc-400">Allowed chat ID<Input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="Optional" className="mt-1" /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void saveTelegramBot()}><Bot className="size-4" /> Add / update Telegram bot</Button>
            <span className="self-center text-xs text-zinc-500">{bots.length ? `${bots.length} connected bot${bots.length > 1 ? 's' : ''}` : 'No bots connected'}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs leading-5 text-zinc-400"><ShieldCheck className="mr-2 inline size-4" /> Signal parsing stays on backend. Duplicate update IDs and active same-symbol signals are rejected before execution.</div>
        </CardContent>
      </Card>

      <Card className="panel-card">
        <CardHeader><CardTitle className="text-base">Live XAU position</CardTitle></CardHeader>
        <CardContent>
          {!position ? <div className="text-sm text-zinc-500">No open XAU position.</div> : <div className="grid gap-3 sm:grid-cols-5 text-sm"><div><span className="text-xs text-zinc-500">Side</span><div className="font-semibold">{Number(position.positionAmt) > 0 ? 'LONG' : 'SHORT'}</div></div><div><span className="text-xs text-zinc-500">Size</span><div>{Math.abs(Number(position.positionAmt))}</div></div><div><span className="text-xs text-zinc-500">Entry</span><div>{position.entryPrice}</div></div><div><span className="text-xs text-zinc-500">Mark</span><div>{position.markPrice}</div></div><div><span className="text-xs text-zinc-500">PnL</span><div>{position.unrealizedProfit}</div></div></div>}
        </CardContent>
      </Card>
      {message && <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-zinc-300">{message}</div>}
    </div>
  );
}
