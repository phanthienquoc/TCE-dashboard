'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ExternalLink, Loader2, Play } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardShell from '../../../../components/dashboard/DashboardShell';
import { api } from '../../../../lib/api';

type StockCronConfig = {
  enabled: boolean;
  schedule: string;
  timezone: string;
  syncStartDate: string | null;
  syncEndDate: string | null;
  batchSize: number;
  priceSyncEnabled: boolean;
  telegramCredentialId: string | null;
  lastRunAt: string | null;
};

type TelegramBot = {
  id: string;
  environment: string;
  name: string;
  isActive: boolean;
  isPaused: boolean;
};

type SyncProgress = {
  phase: 'EVENTS' | 'SSI_PRICE' | 'COMPLETED' | 'FAILED';
  progressPct: number;
  processedEvents: number;
  estimatedTotalEvents: number | null;
  currentPage: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  symbolsRequested: number;
  symbolsSynced: number;
  updatedAt: string;
};

type StockRun = {
  id: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
  started_at: string;
  finished_at: string | null;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  symbols_requested: number;
  symbols_synced: number;
  error_message: string | null;
  metadata?: { progress?: SyncProgress } | null;
};

type ProfitConfig = {
  enabled: boolean;
  profitTargetPct: number;
  intervalMinutes: number;
  holdSymbols: string[];
  lastRunAt: string | null;
  availableSymbols?: string[];
};

type TriggerResult = {
  notified: number;
  evaluated: number;
  held: number;
  submitted: number;
  messages?: string[];
  candidates?: Array<{
    symbol: string;
    currentPrice: number;
    buyPrice: number;
    targetPrice: number;
    currentProfitPct: number;
    action: string;
    reason?: string;
  }>;
};

export default function CronManagementPage() {
  const { cronid } = useParams<{ cronid: string }>();
  return cronid === 'stock-events-sync' ? <StockEventsCronPage /> : <ProfitExitCronPage />;
}

function ProfitExitCronPage() {
  const [config, setConfig] = useState<ProfitConfig>({
    enabled: false,
    profitTargetPct: 10,
    intervalMinutes: 60,
    holdSymbols: [],
    lastRunAt: null,
  });
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<TriggerResult | null>(null);

  useEffect(() => {
    void api
      .get<ProfitConfig>('/profit-exit-settings')
      .then(r => setConfig({ ...r.data, holdSymbols: r.data.holdSymbols ?? [] }))
      .catch(() => setMessage('Unable to load cron configuration'));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const r = await api.post<ProfitConfig>('/profit-exit-settings', config);
      setConfig(c => ({ ...c, ...r.data, holdSymbols: r.data.holdSymbols ?? c.holdSymbols }));
      setMessage('Saved');
    } catch {
      setMessage('Unable to save');
    } finally {
      setSaving(false);
    }
  }

  async function trigger() {
    setTriggering(true);
    setMessage(null);
    setResult(null);
    try {
      const r = await api.post<TriggerResult>('/profit-exit-settings/trigger', {});
      setResult(r.data);
      setConfig(c => ({ ...c, lastRunAt: new Date().toISOString() }));
      setMessage(`${r.data.notified ?? 0} tracking messages · ${r.data.evaluated ?? 0} positions evaluated`);
    } catch {
      setMessage('Unable to trigger profit-exit tracking');
    } finally {
      setTriggering(false);
    }
  }

  const symbols = config.availableSymbols ?? [];
  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view space-y-6">
          <header className="px-1 pt-2">
            <Link href="/settings/cron" className="mb-4 inline-flex items-center gap-1 text-sm text-sky-300">
              <ChevronLeft className="size-4" /> Cron Jobs
            </Link>
            <h1 className="text-2xl font-semibold text-white">Auto Profit Exit</h1>
            <p className="mt-1 text-sm text-slate-400">Track open positions near the buy price; no SSI order submission.</p>
          </header>
          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              <label className="flex min-h-[72px] items-center gap-4 px-4">
                <span className="flex-1"><strong className="block text-[16px] text-white">Enabled</strong><span className="text-sm text-slate-400">Run during Vietnam market sessions</span></span>
                <input type="checkbox" className="size-5 accent-sky-400" checked={config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} />
              </label>
            </div>
          </section>
          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Schedule</p>
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-sm text-white">Profit Target %</span><input className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white" type="number" min="0" step="0.5" value={config.profitTargetPct} onChange={e => setConfig(c => ({ ...c, profitTargetPct: Number(e.target.value) }))} /></label>
              <label className="block"><span className="mb-1 block text-sm text-white">Run Every (minutes)</span><input className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white" type="number" min="1" max="1440" value={config.intervalMinutes} onChange={e => setConfig(c => ({ ...c, intervalMinutes: Number(e.target.value) }))} /></label>
            </div>
          </section>
          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">HOLD Symbols</p>
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              {symbols.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{symbols.map(symbol => <label key={symbol} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200"><input type="checkbox" className="size-4 accent-amber-400" checked={config.holdSymbols.includes(symbol)} onChange={() => setConfig(c => ({ ...c, holdSymbols: c.holdSymbols.includes(symbol) ? c.holdSymbols.filter(v => v !== symbol) : [...c.holdSymbols, symbol].sort() }))} />{symbol}</label>)}</div> : <p className="text-sm text-slate-500">No open positions available.</p>}
            </div>
          </section>
          <section><div className="flex gap-3"><button type="button" disabled={triggering} onClick={() => void trigger()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 font-semibold text-amber-200"><Play className="size-4" />{triggering ? 'Tracking…' : 'Trigger Tracking'}</button><button type="button" disabled={saving} onClick={() => void save()} className="min-h-11 flex-1 rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white">{saving ? 'Saving…' : 'Save Changes'}</button></div>{message ? <p className="mt-3 text-center text-sm text-slate-400">{message}</p> : null}</section>
          {result ? <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm font-semibold text-white">System response</p><p className="mt-1 text-sm text-slate-400">Evaluated {result.evaluated}, HOLD {result.held}, messages {result.notified}, SSI submitted {result.submitted}.</p>{result.messages?.map(item => <p key={item} className="mt-2 text-sm text-amber-200">{item}</p>)}</section> : null}
        </div>
      )}
    </DashboardShell>
  );
}

function StockEventsCronPage() {
  const [config, setConfig] = useState<StockCronConfig>({
    enabled: false,
    schedule: '*/15 * * * *',
    timezone: 'Asia/Ho_Chi_Minh',
    syncStartDate: null,
    syncEndDate: null,
    batchSize: 200,
    priceSyncEnabled: true,
    telegramCredentialId: null,
    lastRunAt: null,
  });
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [runs, setRuns] = useState<StockRun[]>([]);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<'runs' | 'config'>('runs');

  async function refreshRuns() {
    const history = await api.get<StockRun[]>('/stock-events-cron/runs?limit=20');
    setRuns(history.data ?? []);
  }

  useEffect(() => {
    void Promise.all([
      api.get<StockCronConfig>('/stock-events-cron/settings'),
      api.get<TelegramBot[]>('/platform/telegram/bots'),
      api.get<StockRun[]>('/stock-events-cron/runs?limit=20'),
    ])
      .then(([settings, telegram, history]) => {
        setConfig(c => ({ ...c, ...settings.data }));
        setBots(telegram.data ?? []);
        setRuns(history.data ?? []);
      })
      .catch(() => setMessage('Unable to load stock events cron data'));
  }, []);

  const runningRuns = runs.filter(run => run.status === 'RUNNING');
  const hasRunning = runningRuns.length > 0;

  useEffect(() => {
    if (!hasRunning) return;
    const timer = window.setInterval(() => {
      void refreshRuns().catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [hasRunning]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await api.post<StockCronConfig>('/stock-events-cron/settings', config);
      setConfig(c => ({ ...c, ...response.data }));
      setMessage('Saved');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save');
    } finally {
      setSaving(false);
    }
  }

  async function trigger() {
    setTriggering(true);
    setMessage(null);
    try {
      const response = await api.post<StockRun>('/stock-events-cron/trigger', {});
      await refreshRuns().catch(() => undefined);
      setMessage(response.data.status === 'RUNNING' ? 'Sync started' : `Sync ${response.data.status.toLowerCase()}`);
      setTab('runs');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to trigger sync');
    } finally {
      setTriggering(false);
    }
  }

  const sortedRuns = [...runs].sort((a, b) => {
    if (a.status === 'RUNNING' && b.status !== 'RUNNING') return -1;
    if (a.status !== 'RUNNING' && b.status === 'RUNNING') return 1;
    return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
  });

  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view space-y-5">
          <header className="px-1 pt-2">
            <Link href="/settings/cron" className="mb-4 inline-flex items-center gap-1 text-sm text-sky-300"><ChevronLeft className="size-4" /> Cron Jobs</Link>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-white">Stock Events Sync</h1>
                <p className="mt-1 text-sm text-slate-400">Vietstock events → Supabase + SSI price enrichment.</p>
              </div>
              {hasRunning ? <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300"><Loader2 className="size-3 animate-spin" /> {runningRuns.length} running</span> : null}
            </div>
          </header>

          <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1">
            <button type="button" onClick={() => setTab('runs')} className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition ${tab === 'runs' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400'}`}>
              Jobs {runs.length ? <span className="ml-1 text-xs opacity-60">{runs.length}</span> : null}
            </button>
            <button type="button" onClick={() => setTab('config')} className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition ${tab === 'config' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400'}`}>
              Config
            </button>
          </div>

          {tab === 'runs' ? (
            <>
              <section className="flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Job history</p>
                  <p className="mt-1 text-sm text-slate-400">Running jobs are always pinned to the top.</p>
                </div>
                {hasRunning ? <span className="text-xs font-medium text-emerald-300">Live · auto refresh</span> : null}
              </section>

              <section className="space-y-3">
                {sortedRuns.length ? sortedRuns.map(run => {
                  const progress = run.metadata?.progress;
                  const progressPct = Math.min(Math.max(Math.round(progress?.progressPct ?? (run.status === 'SUCCEEDED' ? 100 : 0)), 0), 100);
                  const phaseLabel = progress?.phase === 'SSI_PRICE' ? 'Enriching prices from SSI' : progress?.phase === 'COMPLETED' ? 'Sync completed' : progress?.phase === 'FAILED' ? 'Sync failed' : 'Fetching events from Vietstock';
                  return (
                    <article key={run.id} className={`overflow-hidden rounded-3xl border bg-white/[0.035] ${run.status === 'RUNNING' ? 'border-emerald-400/25 shadow-[0_0_30px_rgba(16,185,129,0.06)]' : 'border-white/10'}`}>
                      <div className="px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`size-2.5 rounded-full ${run.status === 'RUNNING' ? 'animate-pulse bg-emerald-400' : run.status === 'FAILED' ? 'bg-red-400' : run.status === 'PARTIAL' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                            <strong className="text-sm text-white">{run.status}</strong>
                            {run.status === 'RUNNING' ? <span className="text-xs font-medium text-emerald-300">LIVE</span> : null}
                          </div>
                          <span className="text-right text-xs text-slate-500">{new Date(run.started_at).toLocaleString('vi-VN')}</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">+{run.inserted_count} new · {run.updated_count} updated · {run.skipped_count} skipped · {run.failed_count} failed · SSI {run.symbols_synced}/{run.symbols_requested}</div>

                        {run.status === 'RUNNING' ? (
                          <div className="mt-4 border-t border-white/10 pt-3">
                            <div className="flex items-end justify-between gap-3">
                              <div><p className="text-xs text-slate-500">Current phase</p><p className="mt-0.5 text-sm font-semibold text-white">{phaseLabel}</p></div>
                              <strong className="text-2xl font-semibold text-white">{progressPct}%</strong>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${progressPct}%` }} /></div>
                            <div className="mt-2 flex justify-between text-xs text-slate-400"><span>{progress?.processedEvents ?? 0} / {progress?.estimatedTotalEvents ?? '—'} events</span><span>Page {progress?.currentPage ?? '—'}</span></div>
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <Metric label="Inserted" value={progress?.inserted ?? run.inserted_count} />
                              <Metric label="Updated" value={progress?.updated ?? run.updated_count} />
                              <Metric label="Skipped" value={progress?.skipped ?? run.skipped_count} />
                              <Metric label="Failed" value={progress?.failed ?? run.failed_count} />
                            </div>
                          </div>
                        ) : null}

                        {run.error_message ? <p className="mt-2 text-xs text-red-300">{run.error_message}</p> : null}
                        {run.finished_at ? <p className="mt-2 text-xs text-slate-500">Finished {new Date(run.finished_at).toLocaleString('vi-VN')}</p> : null}
                      </div>
                    </article>
                  );
                }) : <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-4 py-10 text-center text-sm text-slate-500">No jobs have run yet.</div>}
              </section>

              <button type="button" disabled={triggering || hasRunning} onClick={() => void trigger()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                <Play className="size-4" />{hasRunning ? 'A job is already running' : triggering ? 'Starting…' : 'Run now'}
              </button>
            </>
          ) : (
            <>
              <section><p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p><div className="rounded-3xl border border-white/10 bg-white/[0.035]"><label className="flex min-h-[72px] items-center gap-4 px-4"><span className="flex-1"><strong className="block text-[16px] text-white">Enabled</strong><span className="text-sm text-slate-400">Dynamic NestJS scheduler</span></span><input type="checkbox" className="size-5 accent-sky-400" checked={config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} /></label></div></section>
              <section><p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Schedule</p><div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 space-y-3"><label className="block"><span className="mb-1 block text-sm text-white">Cron expression</span><input className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white" value={config.schedule} onChange={e => setConfig(c => ({ ...c, schedule: e.target.value }))} /></label><label className="block"><span className="mb-1 block text-sm text-white">Timezone</span><input className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white" value={config.timezone} onChange={e => setConfig(c => ({ ...c, timezone: e.target.value }))} /></label></div></section>
              <section><p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sync Window</p><div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-sm text-white">Start date</span><input type="date" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white" value={config.syncStartDate ?? ''} onChange={e => setConfig(c => ({ ...c, syncStartDate: e.target.value || null }))} /></label><label className="block"><span className="mb-1 block text-sm text-white">End date</span><input type="date" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white" value={config.syncEndDate ?? ''} onChange={e => setConfig(c => ({ ...c, syncEndDate: e.target.value || null }))} /></label></div><p className="mt-2 px-1 text-xs text-slate-500">SYNCED + unchanged hash ⇒ skip. Changed event ⇒ resync.</p></section>
              <section><p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Batch + Price</p><div className="rounded-3xl border border-white/10 bg-white/[0.035]"><label className="flex min-h-[72px] items-center gap-4 border-b border-white/10 px-4"><span className="flex-1"><strong className="block text-[16px] text-white">Batch size</strong><span className="text-sm text-slate-400">50–500 events per upsert</span></span><input type="number" min="50" max="500" step="50" className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-white" value={config.batchSize} onChange={e => setConfig(c => ({ ...c, batchSize: Number(e.target.value) }))} /></label><label className="flex min-h-[72px] items-center gap-4 px-4"><span className="flex-1"><strong className="block text-[16px] text-white">SSI price enrichment</strong><span className="text-sm text-slate-400">Use existing SSI service in batches</span></span><input type="checkbox" className="size-5 accent-emerald-400" checked={config.priceSyncEnabled} onChange={e => setConfig(c => ({ ...c, priceSyncEnabled: e.target.checked }))} /></label></div></section>
              <section><div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Telegram</p><Link href="/notifications/new" className="inline-flex items-center gap-1 text-xs font-medium text-sky-300">Add bot <ExternalLink className="size-3" /></Link></div><div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4"><select className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white" value={config.telegramCredentialId ?? ''} onChange={e => setConfig(c => ({ ...c, telegramCredentialId: e.target.value || null }))}><option value="">No Telegram notification</option>{bots.filter(bot => bot.isActive && !bot.isPaused).map(bot => <option key={bot.id} value={bot.id}>{bot.name} · {bot.environment}</option>)}</select><p className="mt-2 text-xs text-slate-500">Send sync summary after each run.</p></div></section>
              <section><div className="flex gap-3"><button type="button" disabled={saving} onClick={() => void save()} className="min-h-11 flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950">{saving ? 'Saving…' : 'Save cron'}</button><button type="button" onClick={() => setTab('runs')} className="min-h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">View jobs</button></div>{message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}</section>
            </>
          )}
        </div>
      )}
    </DashboardShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-0.5 text-base font-semibold text-white">{value.toLocaleString('en-US')}</p></div>;
}
