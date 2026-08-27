'use client';

import { useEffect, useState } from 'react';
import { Bot, Eye, EyeOff, Loader2, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { platformApi } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';

export default function TelegramBotConfig() {
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [environment, setEnvironment] = useState<'production' | 'testnet'>('production');
  const [configured, setConfigured] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => { void load(); }, []);
  async function load() {
    try {
      const response = await platformApi.credentials();
      const rows = response.data?.credentials ?? response.data ?? [];
      setConfigured(Array.isArray(rows) && rows.some((row: any) => row.provider === 'telegram'));
    } catch { setConfigured(false); }
  }
  async function save() {
    if (!token.trim()) { setOk(false); setMessage('Bot Token is required.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await platformApi.telegramSave({ token: token.trim(), chatId: chatId.trim() || undefined, environment });
      if (!response.data?.ok) throw new Error(response.data?.message ?? 'Unable to save Telegram bot');
      setConfigured(true); setToken(''); setOk(true); setMessage(`Connected to @${response.data.bot?.username ?? response.data.bot?.first_name ?? 'bot'}. Token is stored encrypted on the backend.`);
    } catch (error: any) { setOk(false); setMessage(error?.response?.data?.message ?? error?.message ?? 'Unable to save Telegram bot'); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setMessage('');
    try { await platformApi.telegramRemove(environment); setConfigured(false); setOk(true); setMessage('Telegram bot disconnected.'); }
    catch (error: any) { setOk(false); setMessage(error?.response?.data?.message ?? error?.message ?? 'Unable to disconnect bot'); }
    finally { setBusy(false); }
  }
  return <Card className="mt-4"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Bot className="size-4"/>Telegram Signal Bot</CardTitle><CardDescription>Telegram is an input gateway only. It never talks to Binance or SSI directly.</CardDescription></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${configured ? 'border-emerald-300/20 text-emerald-300' : 'border-white/10 text-zinc-500'}`}>{configured ? 'Configured' : 'Not configured'}</span></div></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs text-zinc-400">Environment</label><select value={environment} onChange={e => setEnvironment(e.target.value as 'production' | 'testnet')} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none"><option value="production">Production</option><option value="testnet">Test / staging</option></select></div><div><label className="mb-1.5 block text-xs text-zinc-400">Allowed Chat ID <span className="text-zinc-600">(optional)</span></label><Input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="Only accept signals from this chat" /></div></div>
    <div><label className="mb-1.5 block text-xs text-zinc-400">Bot Token</label><div className="relative"><Input value={token} onChange={e => setToken(e.target.value)} type={showToken ? 'text' : 'password'} autoComplete="new-password" placeholder={configured ? 'Enter a new token to replace current bot' : '123456789:AA...'} className="pr-11"/><button type="button" onClick={() => setShowToken(v => !v)} className="absolute right-2 top-2 rounded-lg p-2 text-zinc-400 hover:text-white" aria-label={showToken ? 'Hide token' : 'Show token'}>{showToken ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button></div></div>
    <div className="rounded-xl border border-violet-300/10 bg-violet-300/[0.04] p-3 text-xs leading-5 text-zinc-400"><ShieldCheck className="mr-2 inline size-4 text-violet-300"/>The token is sent only to the backend and persisted through the encrypted platform credential store. The UI never receives the stored token back.</div>
    <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={() => void save()}>{busy ? <Loader2 className="size-4 animate-spin"/> : <Save className="size-4"/>}{configured ? 'Replace & connect' : 'Save & connect'}</Button>{configured && <Button type="button" variant="outline" disabled={busy} onClick={() => void remove()}><Trash2 className="size-4"/>Disconnect</Button>}</div>
    {message && <div className={`rounded-xl border p-3 text-sm ${ok ? 'border-emerald-300/15 text-emerald-200' : 'border-red-300/15 text-red-200'}`}>{message}</div>}
  </CardContent></Card>;
}
