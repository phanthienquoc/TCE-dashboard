'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, Play } from 'lucide-react';
import Link from 'next/link';
import DashboardShell from '../../../../components/dashboard/DashboardShell';
import { api } from '../../../../lib/api';

const DEFAULTS = { enabled: false, profitTargetPct: 10, intervalMinutes: 60, holdSymbols: [] as string[] };
type Config = typeof DEFAULTS & { lastRunAt: string | null; availableSymbols?: string[] };
type TriggerResult = {
  created: number;
  evaluated: number;
  held: number;
  dryRun?: boolean;
  candidates: Array<{
    symbol: string;
    profitPct: number;
    targetPrice: number;
    quantity: number;
    action: 'CREATE' | 'SKIP_HOLD';
  }>;
};

export default function CronManagementPage() {
  const params = useParams<{ cronid: string }>();
  const [config, setConfig] = useState<Config>({ ...DEFAULTS, lastRunAt: null });
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<TriggerResult | null>(null);

  useEffect(() => {
    void api
      .get<Config>('/profit-exit-settings')
      .then(r => setConfig({ ...r.data, holdSymbols: r.data.holdSymbols ?? [] }))
      .catch(() => setMessage('Unable to load cron configuration'));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const r = await api.post<Config>('/profit-exit-settings', config);
      setConfig(c => ({ ...c, ...r.data, holdSymbols: r.data.holdSymbols ?? c.holdSymbols }));
      setMessage('Saved');
    } catch {
      setMessage('Unable to save');
    } finally {
      setSaving(false);
    }
  }

  async function triggerTest() {
    setTriggering(true);
    setMessage(null);
    setTriggerResult(null);
    try {
      const r = await api.post<TriggerResult>('/profit-exit-settings/trigger', {});
      setTriggerResult(r.data);
      setMessage('Test run completed — no orders were created');
    } catch {
      setMessage('Unable to run test trigger');
    } finally {
      setTriggering(false);
    }
  }

  function toggleHold(symbol: string) {
    setConfig(c => ({
      ...c,
      holdSymbols: c.holdSymbols.includes(symbol)
        ? c.holdSymbols.filter(item => item !== symbol)
        : [...c.holdSymbols, symbol].sort(),
    }));
  }

  const title = params.cronid === 'auto-profit-exit' ? 'Auto Profit Exit' : params.cronid;
  const symbols = config.availableSymbols ?? [];
  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view space-y-6">
          <header className="px-1 pt-2">
            <Link
              href="/settings/cron"
              className="mb-4 inline-flex items-center gap-1 text-sm text-sky-300"
            >
              <ChevronLeft className="size-4" /> Cron Jobs
            </Link>
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            <p className="mt-1 text-sm text-slate-400">
              Configure when TCE creates profit-exit SELL orders.
            </p>
          </header>

          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Status
            </p>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              <label className="flex min-h-[72px] items-center gap-4 px-4">
                <span className="flex-1">
                  <strong className="block text-[16px] text-white">Enabled</strong>
                  <span className="text-sm text-slate-400">Run during Vietnam market sessions</span>
                </span>
                <input
                  type="checkbox"
                  className="size-5 accent-sky-400"
                  checked={config.enabled}
                  onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))}
                />
              </label>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Schedule
            </p>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              <label className="flex min-h-[72px] items-center gap-4 border-b border-white/10 px-4">
                <span className="flex-1">
                  <strong className="block text-[16px] text-white">Profit Target</strong>
                  <span className="text-sm text-slate-400">Percent above total buy cost</span>
                </span>
                <input
                  className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-white"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.5"
                  value={config.profitTargetPct}
                  onChange={e => setConfig(c => ({ ...c, profitTargetPct: Number(e.target.value) }))}
                />
              </label>
              <label className="flex min-h-[72px] items-center gap-4 px-4">
                <span className="flex-1">
                  <strong className="block text-[16px] text-white">Run Every</strong>
                  <span className="text-sm text-slate-400">Scheduler check interval</span>
                </span>
                <input
                  className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-white"
                  type="number"
                  min="1"
                  max="1440"
                  value={config.intervalMinutes}
                  onChange={e => setConfig(c => ({ ...c, intervalMinutes: Number(e.target.value) }))}
                />
              </label>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              HOLD Symbols
            </p>
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-3">
              {symbols.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {symbols.map(symbol => (
                    <label
                      key={symbol}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-slate-200"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-amber-400"
                        checked={config.holdSymbols.includes(symbol)}
                        onChange={() => toggleHold(symbol)}
                      />
                      {symbol}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="px-1 py-2 text-sm text-slate-500">No open positions available.</p>
              )}
              <p className="mt-3 px-1 text-xs text-slate-500">
                HOLD symbols are never allowed to create an auto-sell order, even when the profit target is reached.
              </p>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Runtime
            </p>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              <div className="flex min-h-[60px] items-center px-4">
                <span className="flex-1 text-sm text-slate-300">Last Run</span>
                <span className="text-sm text-white">{config.lastRunAt ? new Date(config.lastRunAt).toLocaleString() : 'Never'}</span>
              </div>
              <div className="flex min-h-[60px] items-center border-t border-white/10 px-4">
                <span className="flex-1 text-sm text-slate-300">Order Policy</span>
                <span className="text-sm text-emerald-300">HOLD guarded · READY</span>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={triggering}
              onClick={() => void triggerTest()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 font-semibold text-sky-200 disabled:opacity-50"
            >
              <Play className="size-4" />
              {triggering ? 'Testing…' : 'Trigger Test'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="w-full rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          {triggerResult && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-sm font-semibold text-white">Dry-run result</p>
              <p className="mt-1 text-sm text-slate-400">
                Evaluated {triggerResult.evaluated}, HOLD {triggerResult.held}, profit candidates {triggerResult.candidates.filter(item => item.action === 'CREATE').length}.
              </p>
              {triggerResult.candidates.length > 0 && (
                <div className="mt-3 space-y-2">
                  {triggerResult.candidates.map((candidate, index) => (
                    <div key={`${candidate.symbol}-${index}`} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm">
                      <span className={candidate.action === 'SKIP_HOLD' ? 'text-amber-300' : 'text-white'}>{candidate.symbol}</span>
                      <span className="text-slate-400">
                        {candidate.action === 'SKIP_HOLD' ? 'HOLD' : `${candidate.profitPct.toFixed(2)}% · would SELL ${candidate.quantity}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          {message && <p className="text-center text-sm text-slate-400">{message}</p>}
        </div>
      )}
    </DashboardShell>
  );
}
