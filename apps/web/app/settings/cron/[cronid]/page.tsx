'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ExternalLink, Loader2, Play } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardShell from '../../../../components/dashboard/DashboardShell';
import { api } from '../../../../lib/api';
import { useStockSyncStore, type StockSyncRun } from '../../../../lib/stock-sync-store';

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
};
type DividendSyncItem = {
  id: string;
  symbol: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
  phase:
    'QUEUED' | 'RESOLVING_RANGE' | 'FETCHING' | 'UPSERTING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  batch_index: number | null;
  batch_total: number | null;
  batch_from: string | null;
  batch_to: string | null;
  rows_synced: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};
type DividendSyncProgress = {
  id: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
  started_at: string;
  finished_at: string | null;
  symbols_requested: number;
  symbols_synced: number;
  rows_synced: number;
  error_message: string | null;
  current_symbol: string | null;
  current_phase: string | null;
  current_batch_index: number | null;
  current_batch_total: number | null;
  current_batch_from: string | null;
  current_batch_to: string | null;
  current_rows_synced: number;
  updated_at: string;
  items: DividendSyncItem[];
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
      setMessage(
        `${r.data.notified ?? 0} tracking messages · ${r.data.evaluated ?? 0} positions evaluated`
      );
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
            <Link
              href="/settings/cron"
              className="mb-4 inline-flex items-center gap-1 text-sm text-sky-300"
            >
              <ChevronLeft className="size-4" /> Cron Jobs
            </Link>
            <h1 className="text-2xl font-semibold text-white">Auto Profit Exit</h1>
            <p className="mt-1 text-sm text-slate-400">
              Track open positions near the buy price; no SSI order submission.
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
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-white">Profit Target %</span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
                  type="number"
                  min="0"
                  step="0.5"
                  value={config.profitTargetPct}
                  onChange={e =>
                    setConfig(c => ({ ...c, profitTargetPct: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-white">Run Every (minutes)</span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
                  type="number"
                  min="1"
                  max="1440"
                  value={config.intervalMinutes}
                  onChange={e =>
                    setConfig(c => ({ ...c, intervalMinutes: Number(e.target.value) }))
                  }
                />
              </label>
            </div>
          </section>
          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              HOLD Symbols
            </p>
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              {symbols.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {symbols.map(symbol => (
                    <label
                      key={symbol}
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-amber-400"
                        checked={config.holdSymbols.includes(symbol)}
                        onChange={() =>
                          setConfig(c => ({
                            ...c,
                            holdSymbols: c.holdSymbols.includes(symbol)
                              ? c.holdSymbols.filter(v => v !== symbol)
                              : [...c.holdSymbols, symbol].sort(),
                          }))
                        }
                      />
                      {symbol}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No open positions available.</p>
              )}
            </div>
          </section>
          <section>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={triggering}
                onClick={() => void trigger()}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 font-semibold text-amber-200"
              >
                <Play className="size-4" />
                {triggering ? 'Tracking…' : 'Trigger Tracking'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="min-h-11 flex-1 rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
            {message ? <p className="mt-3 text-center text-sm text-slate-400">{message}</p> : null}
          </section>
          {result ? (
            <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-sm font-semibold text-white">System response</p>
              <p className="mt-1 text-sm text-slate-400">
                Evaluated {result.evaluated}, HOLD {result.held}, messages {result.notified}, SSI
                submitted {result.submitted}.
              </p>
              {result.messages?.map(item => (
                <p key={item} className="mt-2 text-sm text-amber-200">
                  {item}
                </p>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </DashboardShell>
  );
}

function StockEventsCronPage() {
  const config = useStockSyncStore(s => s.config),
    bots = useStockSyncStore(s => s.bots),
    runs = useStockSyncStore(s => s.runs),
    loading = useStockSyncStore(s => s.loading),
    saving = useStockSyncStore(s => s.saving),
    triggering = useStockSyncStore(s => s.triggering),
    message = useStockSyncStore(s => s.message),
    tab = useStockSyncStore(s => s.tab),
    initialized = useStockSyncStore(s => s.initialized),
    refresh = useStockSyncStore(s => s.refresh),
    refreshRuns = useStockSyncStore(s => s.refreshRuns),
    save = useStockSyncStore(s => s.save),
    trigger = useStockSyncStore(s => s.trigger),
    setConfig = useStockSyncStore(s => s.setConfig),
    setTab = useStockSyncStore(s => s.setTab);
  const [ohlcvProgress, setOhlcvProgress] = useState<DividendSyncProgress | null>(null);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const runningRuns = runs.filter(run => run.status === 'RUNNING'),
    hasRunning = runningRuns.length > 0;
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'hidden') return;
      void refreshRuns().catch(() => undefined);
      void api
        .get<{ ok: boolean; data: DividendSyncProgress | null }>(
          `/dashboard/dividend-ohlcv-sync-progress?_ts=${Date.now()}`,
          { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }
        )
        .then(r => setOhlcvProgress(r.data.data))
        .catch(() => undefined);
    };
    poll();
    const timer = window.setInterval(
      poll,
      hasRunning || ohlcvProgress?.status === 'RUNNING' ? 1500 : 10000
    );
    window.addEventListener('focus', poll);
    document.addEventListener('visibilitychange', poll);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', poll);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [hasRunning, refreshRuns, ohlcvProgress?.status]);
  const sortedRuns = [...runs].sort((a, b) => {
    if (a.status === 'RUNNING' && b.status !== 'RUNNING') return -1;
    if (a.status !== 'RUNNING' && b.status === 'RUNNING') return 1;
    return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
  });
  const syncRun = runningRuns[0] ?? sortedRuns[0] ?? null;
  const historyRuns = syncRun ? sortedRuns.filter(run => run.id !== syncRun.id) : sortedRuns;
  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view space-y-5">
          <header className="px-1 pt-2">
            <Link
              href="/settings/cron"
              className="mb-4 inline-flex items-center gap-1 text-sm text-sky-300"
            >
              <ChevronLeft className="size-4" /> Cron Jobs
            </Link>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-white">Stock Events Sync</h1>
                <p className="mt-1 text-sm text-slate-400">
                  Vietstock events → Supabase + SSI price enrichment.
                </p>
              </div>
              {hasRunning || ohlcvProgress?.status === 'RUNNING' ? (
                <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  <Loader2 className="size-3 animate-spin" />{' '}
                  {hasRunning ? `${runningRuns.length} running` : 'OHLCV running'}
                </span>
              ) : null}
            </div>
          </header>
          <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1">
            <button
              type="button"
              onClick={() => setTab('runs')}
              className={`min-h-11 rounded-xl border transition ${tab === 'runs' ? 'border-sky-400/30 bg-sky-400/10 text-sky-200 shadow-sm' : 'border-transparent bg-transparent text-slate-400 hover:text-slate-200'}`}
            >
              Jobs{' '}
              {runs.length ? (
                <span className="ml-1 text-xs text-sky-300/80">{runs.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setTab('config')}
              className={`min-h-11 rounded-xl border transition ${tab === 'config' ? 'border-sky-400/30 bg-sky-400/10 text-sky-200 shadow-sm' : 'border-transparent bg-transparent text-slate-400 hover:text-slate-200'}`}
            >
              Config
            </button>
          </div>
          {tab === 'runs' ? (
            <>
              <section className="space-y-3">
                {ohlcvProgress ? <DividendOhlcvProgressCard progress={ohlcvProgress} /> : null}
                {loading && !initialized ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-4 py-10 text-center text-sm text-slate-500">
                    Loading sync status…
                  </div>
                ) : null}
                {!loading && !syncRun ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-4 py-8 text-center text-sm text-slate-500">
                    No sync has run yet.
                  </div>
                ) : null}
                {syncRun ? <StockRunCard run={syncRun} /> : null}
              </section>
              <section className="flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Job history
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Running jobs are always pinned to the sync status above.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {hasRunning || ohlcvProgress?.status === 'RUNNING' ? (
                    <span className="text-xs font-medium text-emerald-300">
                      Live · auto refresh
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Run now"
                    title="Run now"
                    disabled={triggering || hasRunning}
                    onClick={() => void trigger()}
                    className="inline-flex size-8 items-center justify-center rounded-xl border border-sky-400/25 bg-sky-400/10 text-sky-200 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {triggering || hasRunning ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                  </button>
                </div>
              </section>
              <section className="space-y-3">
                {!loading && !historyRuns.length ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-4 py-8 text-center text-sm text-slate-500">
                    No previous jobs.
                  </div>
                ) : null}
                {historyRuns.map(run => (
                  <StockRunCard key={run.id} run={run} />
                ))}
              </section>
              {message ? <p className="text-center text-sm text-slate-400">{message}</p> : null}
            </>
          ) : (
            <CronConfig
              config={config}
              bots={bots}
              saving={saving}
              save={save}
              setConfig={setConfig}
              setTab={setTab}
              message={message}
            />
          )}
        </div>
      )}
    </DashboardShell>
  );
}

function DividendOhlcvProgressCard({ progress }: { progress: DividendSyncProgress }) {
  const items = progress.items ?? [];
  const running = items.find(i => i.status === 'RUNNING');
  const percent = progress.symbols_requested
    ? Math.round(
        ((progress.symbols_synced + (running ? 0.5 : 0)) / progress.symbols_requested) * 100
      )
    : progress.status === 'SUCCEEDED'
      ? 100
      : 0;
  return (
    <article className="overflow-hidden rounded-3xl border border-emerald-400/25 bg-white/[0.035] shadow-[0_0_30px_rgba(16,185,129,0.06)]">
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`size-2.5 rounded-full ${progress.status === 'RUNNING' ? 'animate-pulse bg-emerald-400' : progress.status === 'FAILED' ? 'bg-red-400' : progress.status === 'PARTIAL' ? 'bg-amber-400' : 'bg-sky-400'}`}
              />
              <strong className="text-sm text-white">OHLCV SYNC</strong>
              <span className="text-xs font-medium text-emerald-300">{progress.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {progress.current_symbol ? (
                <>
                  <span className="font-semibold text-white">{progress.current_symbol}</span> ·{' '}
                  {formatDividendPhase(progress.current_phase)}
                </>
              ) : (
                'Waiting for next stock'
              )}
            </p>
          </div>
          <strong className="text-2xl font-semibold text-white">
            {Math.min(100, Math.max(0, percent))}%
          </strong>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-400">
          <span>
            {progress.symbols_synced}/{progress.symbols_requested} stocks ·{' '}
            {progress.rows_synced.toLocaleString('en-US')} rows
          </span>
          <span>
            {progress.current_batch_index && progress.current_batch_total
              ? `Batch ${progress.current_batch_index}/${progress.current_batch_total}`
              : ''}
          </span>
        </div>
        {progress.current_batch_from ? (
          <p className="mt-1 text-xs text-slate-500">
            Fetching {progress.current_batch_from} →{' '}
            {progress.current_batch_to ?? progress.current_batch_from}
          </p>
        ) : null}
      </div>
      <div className="max-h-80 space-y-2 overflow-auto border-t border-white/10 p-3">
        {items.map(item => (
          <DividendSyncItemRow key={item.id} item={item} />
        ))}
      </div>
    </article>
  );
}
function DividendSyncItemRow({ item }: { item: DividendSyncItem }) {
  const tone =
    item.status === 'RUNNING'
      ? 'text-emerald-300'
      : item.status === 'FAILED'
        ? 'text-red-300'
        : item.status === 'SUCCEEDED'
          ? 'text-sky-300'
          : item.status === 'SKIPPED'
            ? 'text-slate-500'
            : 'text-slate-300';
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <strong className="text-sm text-white">{item.symbol}</strong>
          <span className={`text-xs font-medium ${tone}`}>{formatDividendPhase(item.phase)}</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          {item.batch_index && item.batch_total
            ? `Batch ${item.batch_index}/${item.batch_total}`
            : item.status === 'SUCCEEDED'
              ? 'Completed'
              : item.status === 'QUEUED'
                ? 'Queued'
                : '—'}
          {item.batch_from ? ` · ${item.batch_from} → ${item.batch_to ?? item.batch_from}` : ''}
          {item.rows_synced ? ` · ${item.rows_synced.toLocaleString('en-US')} rows` : ''}
        </div>
      </div>
      <span className={`shrink-0 text-[11px] font-semibold ${tone}`}>{item.status}</span>
    </div>
  );
}
function formatDividendPhase(phase: string | null | undefined) {
  switch (phase) {
    case 'RESOLVING_RANGE':
      return 'Resolve range';
    case 'FETCHING':
      return 'Fetching K-line';
    case 'UPSERTING':
      return 'Upserting';
    case 'COMPLETED':
      return 'Completed';
    case 'FAILED':
      return 'Failed';
    case 'SKIPPED':
      return 'Skipped';
    default:
      return 'Queued';
  }
}
function CronConfig({
  config,
  bots,
  saving,
  save,
  setConfig,
  setTab,
  message,
}: {
  config: any;
  bots: any[];
  saving: boolean;
  save: () => Promise<void>;
  setConfig: (value: any) => void;
  setTab: (tab: 'runs' | 'config') => void;
  message: string | null;
}) {
  return (
    <>
      <section>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Status
        </p>
        <div className="rounded-3xl border border-white/10 bg-white/[0.035]">
          <label className="flex min-h-[72px] items-center gap-4 px-4">
            <span className="flex-1">
              <strong className="block text-[16px] text-white">Enabled</strong>
              <span className="text-sm text-slate-400">Dynamic NestJS scheduler</span>
            </span>
            <input
              type="checkbox"
              className="size-5 accent-sky-400"
              checked={config.enabled}
              onChange={e => setConfig((c: any) => ({ ...c, enabled: e.target.checked }))}
            />
          </label>
        </div>
      </section>
      <section>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Schedule
        </p>
        <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-white">Cron expression</span>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
              value={config.schedule}
              onChange={e => setConfig((c: any) => ({ ...c, schedule: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-white">Timezone</span>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
              value={config.timezone}
              onChange={e => setConfig((c: any) => ({ ...c, timezone: e.target.value }))}
            />
          </label>
        </div>
      </section>
      <section>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Sync Window
        </p>
        <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-white">Start date</span>
            <input
              type="date"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
              value={config.syncStartDate ?? ''}
              onChange={e =>
                setConfig((c: any) => ({ ...c, syncStartDate: e.target.value || null }))
              }
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-white">End date</span>
            <input
              type="date"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
              value={config.syncEndDate ?? ''}
              onChange={e => setConfig((c: any) => ({ ...c, syncEndDate: e.target.value || null }))}
            />
          </label>
        </div>
        <p className="mt-2 px-1 text-xs text-slate-500">
          SYNCED + unchanged hash ⇒ skip. Changed event ⇒ resync.
        </p>
      </section>
      <section>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Batch + Price
        </p>
        <div className="rounded-3xl border border-white/10 bg-white/[0.035]">
          <label className="flex min-h-[72px] items-center gap-4 border-b border-white/10 px-4">
            <span className="flex-1">
              <strong className="block text-[16px] text-white">Batch size</strong>
              <span className="text-sm text-slate-400">50–500 events per upsert</span>
            </span>
            <input
              type="number"
              min="50"
              max="500"
              step="50"
              className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-white"
              value={config.batchSize}
              onChange={e => setConfig((c: any) => ({ ...c, batchSize: Number(e.target.value) }))}
            />
          </label>
          <label className="flex min-h-[72px] items-center gap-4 border-b border-white/10 px-4">
            <span className="flex-1">
              <strong className="block text-[16px] text-white">Vietstock page size</strong>
              <span className="text-sm text-slate-400">1–100 rows per source page</span>
            </span>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-white"
              value={config.pageSize}
              onChange={e => setConfig((c: any) => ({ ...c, pageSize: Number(e.target.value) }))}
            />
          </label>
          <label className="flex min-h-[72px] items-center gap-4 px-4">
            <span className="flex-1">
              <strong className="block text-[16px] text-white">SSI price enrichment</strong>
              <span className="text-sm text-slate-400">Use existing SSI service in batches</span>
            </span>
            <input
              type="checkbox"
              className="size-5 accent-emerald-400"
              checked={config.priceSyncEnabled}
              onChange={e => setConfig((c: any) => ({ ...c, priceSyncEnabled: e.target.checked }))}
            />
          </label>
        </div>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Telegram
          </p>
          <Link
            href="/notifications/new"
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-300"
          >
            Add bot <ExternalLink className="size-3" />
          </Link>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
          <select
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
            value={config.telegramCredentialId ?? ''}
            onChange={e =>
              setConfig((c: any) => ({ ...c, telegramCredentialId: e.target.value || null }))
            }
          >
            <option value="">No Telegram notification</option>
            {bots
              .filter((bot: any) => bot.isActive && !bot.isPaused)
              .map((bot: any) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name} · {bot.environment}
                </option>
              ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">Send sync summary after each run.</p>
        </div>
      </section>
      <section>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="min-h-11 flex-1 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white"
          >
            {saving ? 'Saving…' : 'Save cron'}
          </button>
          <button
            type="button"
            onClick={() => setTab('runs')}
            className="min-h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
          >
            View jobs
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
      </section>
    </>
  );
}
function StockRunCard({ run }: { run: StockSyncRun }) {
  const progress = run.metadata?.progress;
  const progressPct = Math.min(
    Math.max(Math.round(progress?.progressPct ?? (run.status === 'SUCCEEDED' ? 100 : 0)), 0),
    100
  );
  const phaseLabel =
    progress?.phase === 'SSI_PRICE'
      ? 'Enriching prices from SSI'
      : progress?.phase === 'COMPLETED'
        ? 'Sync completed'
        : progress?.phase === 'FAILED'
          ? 'Sync failed'
          : 'Fetching events from Vietstock';
  const rowsOnPage = progress?.rowsOnPage ?? 0;
  const pageSize = progress?.pageSize ?? null;
  const hasMore = progress?.hasMore ?? false;
  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white/[0.035] ${run.status === 'RUNNING' ? 'border-emerald-400/25 shadow-[0_0_30px_rgba(16,185,129,0.06)]' : 'border-white/10'}`}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${run.status === 'RUNNING' ? 'animate-pulse bg-emerald-400' : run.status === 'FAILED' ? 'bg-red-400' : run.status === 'PARTIAL' ? 'bg-amber-400' : 'bg-sky-400'}`}
            />
            <strong className="text-sm text-white">{run.status}</strong>
            {run.status === 'RUNNING' ? (
              <span className="text-xs font-medium text-emerald-300">LIVE</span>
            ) : null}
          </div>
          <span className="text-right text-xs text-slate-500">
            {new Date(run.started_at).toLocaleString('vi-VN')}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          +{run.inserted_count} new · {run.updated_count} updated · {run.skipped_count} skipped ·{' '}
          {run.failed_count} failed · SSI {run.symbols_synced}/{run.symbols_requested}
        </div>
        {run.status === 'RUNNING' ? (
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Current phase</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{phaseLabel}</p>
              </div>
              <strong className="text-2xl font-semibold text-white">{progressPct}%</strong>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <span className="rounded-xl bg-black/20 px-3 py-2">
                Page <strong className="text-white">{progress?.currentPage ?? '—'}</strong>
              </span>
              <span className="rounded-xl bg-black/20 px-3 py-2">
                Fetched <strong className="text-white">{rowsOnPage}</strong> rows
                {pageSize != null ? ` · page size ${pageSize}` : ''}
              </span>
              <span className="rounded-xl bg-black/20 px-3 py-2">
                Events processed{' '}
                <strong className="text-white">{progress?.processedEvents ?? 0}</strong>
                {progress?.estimatedTotalEvents != null
                  ? ` / ${progress.estimatedTotalEvents}`
                  : ''}
              </span>
              <span
                className={`rounded-xl bg-black/20 px-3 py-2 ${hasMore ? 'text-emerald-300' : 'text-sky-300'}`}
              >
                {hasMore ? 'Has more → next page' : 'Last page → done'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Inserted" value={progress?.inserted ?? run.inserted_count} />
              <Metric label="Updated" value={progress?.updated ?? run.updated_count} />
              <Metric label="Skipped" value={progress?.skipped ?? run.skipped_count} />
              <Metric label="Failed" value={progress?.failed ?? run.failed_count} />
            </div>
          </div>
        ) : null}
        {run.error_message ? (
          <p className="mt-2 text-xs text-red-300">{run.error_message}</p>
        ) : null}
        {run.finished_at ? (
          <p className="mt-2 text-xs text-slate-500">
            Finished {new Date(run.finished_at).toLocaleString('vi-VN')}
          </p>
        ) : null}
      </div>
    </article>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-white">{value.toLocaleString('en-US')}</p>
    </div>
  );
}
