'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Info,
  Pause,
  Play,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { getEngine } from '../engine-registry';
import { dashboardApi, platformApi } from '../../../lib/api';
import { useEngineRuntimeStore } from '../../../lib/engine-runtime-store';

type ActionResult = { ok: boolean; message: string } | null;
type EngineValue = string | number | boolean;
type EngineConfig = Record<string, EngineValue>;
type Tab = 'overview' | 'configuration' | 'activity';
type SsiAuthDetails = { transactionId?: string; action?: string; message?: string };

const CONFIG_GROUPS: Record<string, string[]> = {
  Decision: ['poolSize', 'maxPositions', 'profitTargetPct', 'maxAssetAllocationPct', 'buyQuantityStep', 'buyFromRemainingBudget'],
  Capital: ['coreCapital', 'burstCapital'],
  Market: ['marketOpen', 'marketClose', 'timezone', 'monitorIntervalMinutes', 'pollingSeconds'],
  Execution: ['autoSellEnabled', 'autoSellProfitTargetPct', 'autoSellIntervalMinutes', 'orderStream', 'portfolioSync', 'reconcileFilledOrders', 'reconcileOpenOrders', 'idempotentClientOrderIds', 'autoProtection'],
};

export default function EngineDetailPage() {
  const params = useParams<{ engineId: string }>();
  const engine = useMemo(() => getEngine(params.engineId), [params.engineId]);
  const { engines, refresh: refreshRuntime } = useEngineRuntimeStore();
  const runtime = useMemo(() => engines.find(item => item.engineId === params.engineId), [engines, params.engineId]);

  const [config, setConfig] = useState<EngineConfig>({});
  const [configUpdatedAt, setConfigUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncingPortfolio, setSyncingPortfolio] = useState(false);
  const [syncResult, setSyncResult] = useState<ActionResult>(null);
  const [portfolioResult, setPortfolioResult] = useState<ActionResult>(null);
  const [ssiOtpOpen, setSsiOtpOpen] = useState(false);
  const [ssiOtp, setSsiOtp] = useState('');
  const [ssiTransactionId, setSsiTransactionId] = useState<string | undefined>();
  const [ssiOtpLoading, setSsiOtpLoading] = useState(false);
  const [ssiOtpError, setSsiOtpError] = useState<string | null>(null);
  const [ssiApprovalWaiting, setSsiApprovalWaiting] = useState(false);

  useEffect(() => {
    void refreshRuntime();
  }, [refreshRuntime]);

  useEffect(() => {
    if (!engine) return;
    let mounted = true;
    setLoading(true);
    void dashboardApi
      .engineConfig()
      .then(response => {
        if (!mounted) return;
        const remote = (response.data ?? {}) as Record<string, unknown>;
        const remoteConfig: EngineConfig = {};
        for (const [key, value] of Object.entries(remote)) {
          if (key === 'updatedAt') continue;
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') remoteConfig[key] = value;
        }
        setConfig({ ...engine.defaults, ...remoteConfig });
        setConfigUpdatedAt(typeof remote.updatedAt === 'string' ? remote.updatedAt : null);
        setSaved(true);
      })
      .catch(() => {
        if (!mounted) return;
        setConfig(engine.defaults);
        setConfigUpdatedAt(null);
        setSaved(true);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [engine]);

  if (!engine) {
    return (
      <div className="engine-detail-page">
        <Card className="panel-card p-5">
          <p className="font-semibold">Engine not found</p>
          <Link href="/engines" className="mt-3 inline-flex text-sm text-[var(--accent)]">Back to engines</Link>
        </Card>
      </div>
    );
  }

  const status = runtime?.status ?? 'PAUSED';
  const isActive = status === 'ACTIVE';
  const statusLabel = status === 'ACTIVE' ? 'Running' : status === 'ERROR' ? 'Error' : 'Paused';
  const visibleGroups = Object.entries(CONFIG_GROUPS)
    .map(([group, keys]) => [group, keys.filter(key => key in config)] as const)
    .filter(([, keys]) => keys.length > 0);
  const ungrouped = Object.keys(config).filter(key => !Object.values(CONFIG_GROUPS).some(keys => keys.includes(key)));
  if (ungrouped.length) visibleGroups.push(['Other', ungrouped]);

  const metricKeys = ['poolSize', 'maxPositions', 'coreCapital', 'burstCapital', 'profitTargetPct', 'maxAssetAllocationPct', 'pollingSeconds']
    .filter(key => key in config)
    .slice(0, 4);

  function update(key: string, value: EngineValue) {
    setConfig(current => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function save() {
    if (saving || loading) return;
    setSaving(true);
    try {
      await dashboardApi.setEngineConfig(config);
      setSaved(true);
      setConfigUpdatedAt(new Date().toISOString());
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (updatingStatus || !runtime) return;
    setUpdatingStatus(true);
    try {
      await dashboardApi.setEngineStatus(engine.id, isActive ? 'INACTIVE' : 'ACTIVE');
      await refreshRuntime();
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function syncMarketData() {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await platformApi.ssiMarketPriceSync();
      const data = response.data as {
        ok?: boolean;
        error?: { message?: string };
        data?: { usersSynced?: number; symbolsRequested?: number; symbolsSynced?: number; failedSymbols?: string[]; partial?: boolean };
      };
      const result = data?.data;
      if (!data?.ok) {
        setSyncResult({ ok: false, message: data?.error?.message ?? 'SSI market sync failed' });
        return;
      }
      const symbolsSynced = Number(result?.symbolsSynced ?? 0);
      const symbolsRequested = Number(result?.symbolsRequested ?? symbolsSynced);
      const usersSynced = Number(result?.usersSynced ?? 0);
      const failed = result?.failedSymbols?.length ? ` Failed: ${result.failedSymbols.join(', ')}.` : '';
      setSyncResult({
        ok: !result?.partial,
        message: result?.partial
          ? `Partial sync: ${symbolsSynced}/${symbolsRequested} symbols across ${usersSynced} account(s).${failed}`
          : `Synced ${symbolsSynced}/${symbolsRequested} symbols across ${usersSynced} account(s).`,
      });
    } catch (error) {
      const value = error as { response?: { data?: { message?: string; error?: { message?: string } } }; message?: string };
      setSyncResult({ ok: false, message: value?.response?.data?.error?.message ?? value?.response?.data?.message ?? value?.message ?? 'SSI market sync failed' });
    } finally {
      setSyncing(false);
    }
  }

  function openSsiApproval(details?: SsiAuthDetails) {
    setSsiTransactionId(details?.transactionId);
    setSsiOtp('');
    setSsiOtpError(null);
    setSsiApprovalWaiting(Boolean(details?.transactionId));
    setSsiOtpOpen(true);
  }

  async function checkSsiApproval() {
    const transactionId = ssiTransactionId?.trim();
    if (!transactionId) {
      setSsiOtpError('SSI approval request has expired. Send a new request.');
      setSsiApprovalWaiting(false);
      return;
    }
    setSsiOtpLoading(true);
    setSsiOtpError(null);
    try {
      const response = await platformApi.ssiApprove({ environment: 'production', transactionId });
      const data = response.data as { ok?: boolean; error?: { message?: string; code?: string; details?: SsiAuthDetails } };
      if (data?.ok) {
        setSsiOtpOpen(false);
        setSsiApprovalWaiting(false);
        setSsiTransactionId(undefined);
        await syncPortfolio();
        return;
      }
      const code = data?.error?.code;
      if (code === 'SSI_REAUTH_PENDING' || code === 'SSI_APPROVAL_PENDING' || /pending|not.*approv|waiting/i.test(data?.error?.message ?? '')) {
        setSsiApprovalWaiting(true);
        setSsiOtpError('SSI approval is still pending. Approve the request in the SSI app, then check again.');
        return;
      }
      if (code === 'SSI_OTP_REQUIRED' || /otp/i.test(data?.error?.message ?? '')) {
        setSsiApprovalWaiting(false);
        setSsiOtpError(data?.error?.message ?? 'SSI requires an OTP.');
        return;
      }
      setSsiOtpError(data?.error?.message ?? 'SSI approval could not be verified.');
    } catch (error) {
      const value = error as { response?: { data?: { error?: { code?: string; message?: string }; message?: string } }; message?: string };
      const authError = value?.response?.data?.error;
      setSsiOtpError(authError?.message ?? value?.response?.data?.message ?? value?.message ?? 'SSI approval could not be verified.');
    } finally {
      setSsiOtpLoading(false);
    }
  }

  async function approveSsiOtp() {
    const otp = ssiOtp.trim();
    if (!otp) {
      setSsiOtpError('Enter the OTP sent by SSI.');
      return;
    }
    setSsiOtpLoading(true);
    setSsiOtpError(null);
    try {
      const response = await platformApi.ssiApprove({ environment: 'production', otp, ...(ssiTransactionId ? { transactionId: ssiTransactionId } : {}) });
      const data = response.data as { ok?: boolean; error?: { message?: string } };
      if (!data?.ok) {
        setSsiOtpError(data?.error?.message ?? 'SSI OTP verification failed');
        return;
      }
      setSsiOtpOpen(false);
      setSsiOtp('');
      setSsiTransactionId(undefined);
      setSsiApprovalWaiting(false);
      await syncPortfolio();
    } catch (error) {
      const value = error as { response?: { data?: { message?: string; error?: { message?: string } } }; message?: string };
      setSsiOtpError(value?.response?.data?.error?.message ?? value?.response?.data?.message ?? value?.message ?? 'SSI OTP verification failed');
    } finally {
      setSsiOtpLoading(false);
    }
  }

  async function syncPortfolio() {
    if (syncingPortfolio) return;
    setSyncingPortfolio(true);
    setPortfolioResult(null);
    try {
      const response = await platformApi.ssiSync({});
      const data = response.data as {
        ok?: boolean;
        error?: { code?: string; message?: string; details?: SsiAuthDetails };
        data?: { accountsSynced?: number; assetsSynced?: number; positionsSynced?: number; positionsClosed?: number; cashSynced?: number };
      };
      const result = data?.data;
      if (!data?.ok) {
        const authError = data?.error;
        if (authError?.code === 'SSI_AUTH_REQUIRED') {
          setPortfolioResult({ ok: false, message: 'Open the SSI app and approve the sign-in request. OTP is only needed if SSI asks for it.' });
          openSsiApproval(authError.details);
          return;
        }
        setPortfolioResult({ ok: false, message: authError?.message ?? 'SSI portfolio sync failed' });
        return;
      }
      const accounts = Number(result?.accountsSynced ?? 0);
      const assets = Number(result?.assetsSynced ?? 0);
      const positions = Number(result?.positionsSynced ?? 0);
      const closed = Number(result?.positionsClosed ?? 0);
      const cash = Number(result?.cashSynced ?? 0);
      setPortfolioResult({
        ok: true,
        message: `Synced ${accounts} SSI account(s), ${assets} asset row(s), ${positions} position(s). Cash ${cash.toLocaleString('vi-VN')} VND.${closed ? ` Closed ${closed} stale position(s).` : ''}`,
      });
    } catch (error) {
      const value = error as { response?: { data?: { message?: string; error?: { code?: string; message?: string; details?: SsiAuthDetails } } }; message?: string };
      const authError = value?.response?.data?.error;
      if (authError?.code === 'SSI_AUTH_REQUIRED') {
        setPortfolioResult({ ok: false, message: 'Open the SSI app and approve the sign-in request. OTP is only needed if SSI asks for it.' });
        openSsiApproval(authError.details);
      } else {
        setPortfolioResult({ ok: false, message: authError?.message ?? value?.response?.data?.message ?? value?.message ?? 'SSI portfolio sync failed' });
      }
    } finally {
      setSyncingPortfolio(false);
    }
  }

  return (
    <div className="engine-detail-page space-y-4 pb-6">
      <header className="space-y-3">
        <Link href="/engines" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-[var(--accent)]">
          <ArrowLeft className="size-4" /> Engines
        </Link>

        <div className="flex items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[var(--accent)]/15 bg-[var(--accent)]/10 text-[var(--accent)]">
            <Settings2 className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold leading-tight">{engine.name}</h1>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status === 'ACTIVE' ? 'bg-emerald-500/12 text-emerald-300' : status === 'ERROR' ? 'bg-red-500/12 text-red-300' : 'bg-white/7 text-slate-400'}`}>
                <span className={`size-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-400' : status === 'ERROR' ? 'bg-red-400' : 'bg-slate-500'}`} />
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">{engine.platform} · {engine.category} · {engine.layer}</p>
          </div>
          <Button
            variant="ghost"
            className="touch-target shrink-0 border border-[var(--line)]"
            disabled={updatingStatus || !runtime}
            onClick={() => void toggleStatus()}
          >
            {updatingStatus ? <RefreshCw className="size-4 animate-spin" /> : isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
            <span className="hidden sm:inline">{isActive ? 'Pause' : 'Start'}</span>
          </Button>
        </div>

        {runtime?.blockedBy?.length ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2.5 text-xs text-amber-100">
            <Info className="mt-0.5 size-4 shrink-0" />
            Blocked by: {runtime.blockedBy.join(', ')}
          </div>
        ) : null}
      </header>

      <nav className="grid grid-cols-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1" aria-label="Engine detail">
        {([
          ['overview', 'Overview'],
          ['configuration', 'Configuration'],
          ['activity', 'Activity'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`min-h-10 rounded-lg px-2 text-xs font-semibold transition ${tab === value ? 'bg-[var(--accent)]/12 text-[var(--accent)] shadow-sm' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="space-y-4">
          <Card className="panel-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Runtime</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-400' : status === 'ERROR' ? 'bg-red-400' : 'bg-slate-500'}`} />
                    <p className="text-xl font-semibold">{statusLabel}</p>
                  </div>
                </div>
                <Activity className="size-5 text-muted" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <RuntimeMeta label="Last state update" value={formatDate(runtime?.updatedAt)} />
                <RuntimeMeta label="Config fields" value={String(Object.keys(config).length)} />
              </div>

              {runtime?.error ? (
                <div className="mt-3 rounded-xl border border-red-300/15 bg-red-300/[0.05] px-3 py-2.5 text-xs text-red-200">{runtime.error}</div>
              ) : (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-2.5 text-xs text-emerald-200">
                  <ShieldCheck className="size-4" /> Runtime state is healthy.
                </div>
              )}
            </CardContent>
          </Card>

          <section>
            <SectionTitle title="Key metrics" />
            <div className="grid grid-cols-2 gap-2">
              {metricKeys.map(key => (
                <MetricCard key={key} label={labelize(key)} value={formatValue(key, config[key])} />
              ))}
            </div>
          </section>

          {engine.id === 'ssi-execution' && (
            <section className="space-y-2">
              <SectionTitle title="Quick actions" />
              <SyncAction title="SSI portfolio" description="Sync SSI accounts and positions into TCE." loading={syncingPortfolio} onClick={() => void syncPortfolio()} />
              <SyncAction title="Market data" description="Trigger SSI market-price sync now." loading={syncing} onClick={() => void syncMarketData()} />
              {portfolioResult ? <ResultBanner result={portfolioResult} /> : null}
              {syncResult ? <ResultBanner result={syncResult} /> : null}
            </section>
          )}

          <section>
            <SectionTitle title="Configuration summary" action={<button type="button" className="text-xs font-semibold text-[var(--accent)]" onClick={() => setTab('configuration')}>Edit</button>} />
            <Card className="panel-card">
              <CardContent className="divide-y divide-[var(--line)] p-0">
                {Object.entries(config).slice(0, 6).map(([key, value]) => (
                  <div key={key} className="flex min-h-12 items-center justify-between gap-3 px-3.5">
                    <span className="text-sm text-muted">{labelize(key)}</span>
                    <span className="max-w-[55%] truncate text-right text-sm font-medium">{formatValue(key, value)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </div>
      )}

      {tab === 'configuration' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--accent)]/12 bg-[var(--accent)]/[0.04] px-3 py-2.5 text-xs text-muted">
            <Info className="size-4 shrink-0 text-[var(--accent)]" />
            Update engine parameters, then save once. Changes are persisted per account.
          </div>

          {loading ? (
            <Card className="panel-card p-5"><p className="text-sm text-muted">Loading configuration…</p></Card>
          ) : (
            visibleGroups.map(([group, keys]) => (
              <ConfigSection key={group} title={group}>
                {keys.map(key => (
                  <ConfigField key={key} keyName={key} value={config[key]} onChange={value => update(key, value)} />
                ))}
              </ConfigSection>
            ))
          )}

          {engine.id === 'ssi-execution' && (
            <div className="space-y-2">
              <SectionTitle title="Provider actions" />
              <SyncAction title="Sync portfolio" description="Reconcile SSI accounts, cash and positions." loading={syncingPortfolio} onClick={() => void syncPortfolio()} />
              <SyncAction title="Sync market data" description="Fetch current SSI market prices." loading={syncing} onClick={() => void syncMarketData()} />
              {portfolioResult ? <ResultBanner result={portfolioResult} /> : null}
              {syncResult ? <ResultBanner result={syncResult} /> : null}
            </div>
          )}

          <div className="sticky bottom-2 z-20 rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)]/95 p-2 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <span className={`px-2 text-xs ${saved ? 'text-emerald-300' : 'text-amber-300'}`}>
                {saved ? 'All changes saved' : 'Unsaved changes'}
              </span>
              <Button className="touch-target" disabled={loading || saving || saved} onClick={() => void save()}>
                {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="space-y-4">
          <Card className="panel-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock3 className="size-5 text-[var(--accent)]" />
                <div>
                  <p className="font-semibold">Latest activity</p>
                  <p className="text-xs text-muted">Current runtime and configuration timestamps.</p>
                </div>
              </div>
              <div className="mt-4 space-y-0">
                <ActivityItem icon={<Activity className="size-3.5" />} title="Runtime state updated" value={formatDate(runtime?.updatedAt)} />
                <ActivityItem icon={<Save className="size-3.5" />} title="Configuration synced" value={formatDate(configUpdatedAt)} />
              </div>
            </CardContent>
          </Card>

          <Card className="panel-card">
            <CardContent className="p-4">
              <p className="font-semibold">Dependencies</p>
              <div className="mt-3 space-y-2">
                {runtime?.dependencies?.length ? runtime.dependencies.map(id => (
                  <div key={id} className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2.5">
                    <span className="text-sm">{id}</span>
                    <ChevronRight className="size-4 text-muted" />
                  </div>
                )) : (
                  <p className="text-sm text-muted">No runtime dependencies.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {ssiOtpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold">SSI approval required</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {ssiApprovalWaiting ? 'Approve the request in the SSI app, then check again.' : 'Enter the OTP sent by SSI.'}
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setSsiOtpOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-white">
                <X className="size-4" />
              </button>
            </div>

            {ssiApprovalWaiting ? (
              <>
                <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-3 text-xs text-amber-100">Waiting for approval in SSI app…</div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="ghost" className="touch-target" disabled={ssiOtpLoading} onClick={() => setSsiOtpOpen(false)}>Close</Button>
                  <Button className="touch-target" disabled={ssiOtpLoading || !ssiTransactionId} onClick={() => void checkSsiApproval()}>
                    <RefreshCw className={`size-4 ${ssiOtpLoading ? 'animate-spin' : ''}`} />
                    {ssiOtpLoading ? 'Checking…' : 'Check approval'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-muted">OTP</span>
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={ssiOtp}
                    onChange={event => setSsiOtp(event.target.value.replace(/\D/g, ''))}
                    onKeyDown={event => { if (event.key === 'Enter') void approveSsiOtp(); }}
                    placeholder="Enter OTP"
                    className="h-12 w-full rounded-xl border border-[var(--line)] bg-white/[0.04] px-3 text-center text-lg tracking-[0.35em] outline-none focus:border-[var(--accent)]/40"
                  />
                </label>
                {ssiOtpError ? <p className="mt-2 text-xs text-red-300">{ssiOtpError}</p> : null}
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="ghost" className="touch-target" disabled={ssiOtpLoading} onClick={() => setSsiOtpOpen(false)}>Cancel</Button>
                  <Button className="touch-target" disabled={ssiOtpLoading || !ssiOtp.trim()} onClick={() => void approveSsiOtp()}>
                    {ssiOtpLoading ? 'Verifying…' : 'Verify & sync'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RuntimeMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-0.5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
      {action}
    </div>
  );
}

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="panel-card">
      <button type="button" onClick={() => setOpen(value => !value)} className="flex min-h-12 w-full items-center justify-between px-4 text-left">
        <span className="flex items-center gap-2 font-semibold">{title}</span>
        <ChevronDown className={`size-4 text-muted transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open ? <CardContent className="divide-y divide-[var(--line)] p-0">{children}</CardContent> : null}
    </Card>
  );
}

function ConfigField({ keyName, value, onChange }: { keyName: string; value: EngineValue; onChange: (value: EngineValue) => void }) {
  const description = fieldDescription(keyName);
  const boolean = typeof value === 'boolean';
  return (
    <div className="flex min-h-[68px] items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{labelize(keyName)}</p>
        {description ? <p className="mt-0.5 text-[11px] leading-4 text-muted">{description}</p> : null}
      </div>
      {boolean ? (
        <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition ${value ? 'bg-[var(--accent)]' : 'bg-white/10'}`}>
          <span className={`block size-6 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : ''}`} />
        </button>
      ) : (
        <div className="relative w-[145px] shrink-0">
          <input
            type={typeof value === 'number' ? 'number' : 'text'}
            inputMode={typeof value === 'number' ? 'decimal' : undefined}
            value={String(value)}
            onChange={event => onChange(typeof value === 'number' ? Number(event.target.value) : event.target.value)}
            className="h-11 w-full rounded-xl border border-[var(--line)] bg-white/[0.03] px-3 text-right text-sm outline-none focus:border-[var(--accent)]/40"
          />
          {suffixFor(keyName) ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffixFor(keyName)}</span> : null}
        </div>
      )}
    </div>
  );
}

function SyncAction({ title, description, loading, onClick }: { title: string; description: string; loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="flex min-h-[60px] w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 text-left transition active:bg-white/[0.04]">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
        {loading ? <RefreshCw className="size-4 animate-spin" /> : <Zap className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </button>
  );
}

function ResultBanner({ result }: { result: { ok: boolean; message: string } }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-xs ${result.ok ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200' : 'border-red-300/15 bg-red-300/[0.05] text-red-200'}`}>
      {result.message}
    </div>
  );
}

function ActivityItem({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{value}</span>
      </span>
      <Check className="size-4 text-emerald-400" />
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function formatValue(key: string, value: EngineValue) {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'number') {
    if (/capital/i.test(key)) return `${new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} ₫`;
    if (/pct/i.test(key)) return `${value}%`;
    if (/interval/i.test(key)) return `${value} min`;
    if (/seconds/i.test(key)) return `${value} s`;
    return new Intl.NumberFormat('vi-VN').format(value);
  }
  return value.replace('Asia/Ho_Chi_Minh', 'Asia/Ho Chi Minh');
}

function suffixFor(key: string) {
  if (/capital/i.test(key)) return '₫';
  if (/pct/i.test(key)) return '%';
  if (/interval/i.test(key)) return 'min';
  if (/seconds/i.test(key)) return 's';
  return '';
}

function fieldDescription(key: string) {
  const descriptions: Record<string, string> = {
    poolSize: 'Number of candidates kept in the pool',
    maxPositions: 'Maximum concurrent positions',
    profitTargetPct: 'Target profit per position',
    maxAssetAllocationPct: 'Maximum allocation per asset',
    buyQuantityStep: 'Quantity step when buying',
    buyFromRemainingBudget: 'Use remaining available budget',
    coreCapital: 'Main capital for trading',
    burstCapital: 'Additional capital for opportunities',
    monitorIntervalMinutes: 'Scan interval during runtime',
    autoSellEnabled: 'Automatically sell positions',
    autoSellProfitTargetPct: 'Profit target for automatic selling',
    autoSellIntervalMinutes: 'Interval for automatic selling',
  };
  return descriptions[key];
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase());
}
