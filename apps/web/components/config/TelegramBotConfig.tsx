'use client';

import { useEffect, useState } from 'react';
import { Bot, Eye, EyeOff, Loader2, Save, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import { platformApi } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';

type BotRow = { id: string; name: string; environment: string; isActive: boolean };
type Assignment = {
  id: string;
  telegram_credential_id: string;
  service_name: string;
  min_level: string;
  enabled: boolean;
};

export default function TelegramBotConfig() {
  const [bots, setBots] = useState<BotRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [name, setName] = useState('alerts');
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [environment, setEnvironment] = useState<'production' | 'testnet'>('production');
  const [serviceName, setServiceName] = useState('tce-engine');
  const [minLevel, setMinLevel] = useState<'DEBUG' | 'INFO' | 'WARN' | 'ERROR'>('INFO');
  const [botId, setBotId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    void load();
  }, []);
  async function load() {
    try {
      const [b, a] = await Promise.all([
        platformApi.telegramBots(),
        platformApi.telegramDebugAssignments(),
      ]);
      const botRows = b.data?.bots ?? b.data ?? [];
      setBots(Array.isArray(botRows) ? botRows : []);
      setAssignments(Array.isArray(a.data) ? a.data : (a.data?.assignments ?? []));
      if (!botId && botRows?.[0]?.id) setBotId(botRows[0].id);
    } catch {
      setBots([]);
      setAssignments([]);
    }
  }
  async function save() {
    if (!token.trim() || !name.trim()) {
      setOk(false);
      setMessage('Bot name and token are required.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await platformApi.telegramSave({
        token: token.trim(),
        chatId: chatId.trim() || undefined,
        environment,
        name: name.trim(),
      });
      if (!response.data?.ok)
        throw new Error(response.data?.message ?? 'Unable to save Telegram bot');
      setToken('');
      setOk(true);
      setMessage(
        `Connected to @${response.data.bot?.username ?? response.data.bot?.first_name ?? 'bot'}.`
      );
      await load();
    } catch (error: any) {
      setOk(false);
      setMessage(error?.response?.data?.message ?? error?.message ?? 'Unable to save Telegram bot');
    } finally {
      setBusy(false);
    }
  }
  async function removeBot(bot: BotRow) {
    setBusy(true);
    try {
      await platformApi.telegramRemove({ environment: bot.environment, name: bot.name });
      setOk(true);
      setMessage(`${bot.name} disconnected.`);
      await load();
    } catch (error: any) {
      setOk(false);
      setMessage(error?.response?.data?.message ?? error?.message ?? 'Unable to disconnect bot');
    } finally {
      setBusy(false);
    }
  }
  async function assign() {
    if (!botId || !serviceName.trim()) return;
    setBusy(true);
    try {
      await platformApi.telegramAssignDebug({
        telegramCredentialId: botId,
        serviceName: serviceName.trim(),
        minLevel,
      });
      setOk(true);
      setMessage('Debug routing assigned.');
      await load();
    } catch (error: any) {
      setOk(false);
      setMessage(
        error?.response?.data?.message ?? error?.message ?? 'Unable to assign debug routing'
      );
    } finally {
      setBusy(false);
    }
  }
  async function unassign(id: string) {
    setBusy(true);
    try {
      await platformApi.telegramUnassignDebug(id);
      await load();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4" />
              Telegram Gateway & Debug
            </CardTitle>
            <CardDescription>
              One account can have multiple Telegram bots. Backend logs/debug are sent only to
              explicitly assigned bots.
            </CardDescription>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${bots.length ? 'border-emerald-300/20 text-emerald-300' : 'border-white/10 text-zinc-500'}`}
          >
            {bots.length ? `${bots.length} bot${bots.length > 1 ? 's' : ''}` : 'No bots'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Bot name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="alerts" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Environment</label>
            <select
              value={environment}
              onChange={e => setEnvironment(e.target.value as any)}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none"
            >
              <option value="production">Production</option>
              <option value="testnet">Test / staging</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">
              Allowed Chat ID <span className="text-zinc-600">(optional)</span>
            </label>
            <Input
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              placeholder="Only accept signals from this chat"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-zinc-400">Bot Token</label>
          <div className="relative">
            <Input
              value={token}
              onChange={e => setToken(e.target.value)}
              type={showToken ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="123456789:AA..."
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowToken(v => !v)}
              className="absolute right-2 top-2 rounded-lg p-2 text-zinc-400 hover:text-white"
              aria-label={showToken ? 'Hide token' : 'Show token'}
            >
              {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-violet-300/10 bg-violet-300/[0.04] p-3 text-xs leading-5 text-zinc-400">
          <ShieldCheck className="mr-2 inline size-4 text-violet-300" />
          Tokens remain encrypted on the backend. Stored tokens are never returned to the browser.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save &
            connect
          </Button>
        </div>
        {bots.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Connected bots
            </div>
            {bots.map(bot => (
              <div
                key={bot.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2"
              >
                <div>
                  <div className="text-sm text-white">{bot.name}</div>
                  <div className="text-xs text-zinc-500">{bot.environment}</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void removeBot(bot)}
                >
                  <Trash2 className="size-4" />
                  Disconnect
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-2xl border border-white/10 p-4 space-y-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Wrench className="size-4" />
              Backend log / debug routing
            </div>
            <div className="mt-1 text-xs text-zinc-500">No assignment = no Telegram delivery.</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={botId}
              onChange={e => setBotId(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white"
            >
              <option value="">Select bot</option>
              {bots.map(bot => (
                <option key={bot.id} value={bot.id}>
                  {bot.name} · {bot.environment}
                </option>
              ))}
            </select>
            <Input
              value={serviceName}
              onChange={e => setServiceName(e.target.value)}
              placeholder="Service name or *"
            />
            <select
              value={minLevel}
              onChange={e => setMinLevel(e.target.value as any)}
              className="h-10 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white"
            >
              <option>DEBUG</option>
              <option>INFO</option>
              <option>WARN</option>
              <option>ERROR</option>
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !botId}
            onClick={() => void assign()}
          >
            Assign routing
          </Button>
          {assignments.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2"
            >
              <div className="text-xs text-zinc-300">
                <span className="text-white">
                  {bots.find(b => b.id === item.telegram_credential_id)?.name ??
                    item.telegram_credential_id}
                </span>{' '}
                · {item.service_name} · ≥ {item.min_level}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void unassign(item.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        {message && (
          <div
            className={`rounded-xl border p-3 text-sm ${ok ? 'border-emerald-300/15 text-emerald-200' : 'border-red-300/15 text-red-200'}`}
          >
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
