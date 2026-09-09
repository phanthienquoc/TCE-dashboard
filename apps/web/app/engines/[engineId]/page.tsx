'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw, Save, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { getEngine } from '../engine-registry';
import { dashboardApi, platformApi } from '../../../lib/api';

type ActionResult = { ok: boolean; message: string } | null;
type EngineConfig = Record<string, string | number | boolean>;
type SsiAuthDetails = { transactionId?: string; action?: string; message?: string };

export default function EngineDetailPage() {
  const params = useParams<{ engineId: string }>();
  const engine = useMemo(() => getEngine(params.engineId), [params.engineId]);
  const [config, setConfig] = useState<EngineConfig>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
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
    if (!engine) return;
    let mounted = true;
    void dashboardApi
      .engineConfig()
      .then(response => {
        if (!mounted) return;
        const remote = (response.data ?? {}) as Record<string, unknown>;
        const remoteConfig: EngineConfig = {};
        for (const [key, value] of Object.entries(remote)) {
          if (key === 'updatedAt') continue;
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
            remoteConfig[key] = value;
        }
        setConfig({ ...engine.defaults, ...remoteConfig });
        setSaved(true);
      })
      .catch(() => {
        if (mounted) {
          setConfig(engine.defaults);
          setSaved(false);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [engine]);

  if (!engine) return <Card className="panel-card p-5">Engine not found.</Card>;

  function update(key: string, value: string | number | boolean) {
    setConfig(current => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaved(false);
    try {
      await dashboardApi.setEngineConfig(config);
      setSaved(true);
    } catch {
      setSaved(false);
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
        data?: {
          usersSynced?: number;
          symbolsRequested?: number;
          symbolsSynced?: number;
          failedSymbols?: string[];
          partial?: boolean;
        };
      };
      const result = data?.data;
      if (!data?.ok) {
        setSyncResult({ ok: false, message: data?.error?.message ?? 'SSI market sync failed' });
        return;
      }
      const symbolsSynced = Number(result?.symbolsSynced ?? 0);
      const symbolsRequested = Number(result?.symbolsRequested ?? symbolsSynced);
      const usersSynced = Number(result?.usersSynced ?? 0);
      const failed = result?.failedSymbols?.length
        ? ` Failed: ${result.failedSymbols.join(', ')}.`
        : '';
      setSyncResult({
        ok: !result?.partial,
        message: result?.partial
          ? `Partial sync: ${symbolsSynced}/${symbolsRequested} symbols across ${usersSynced} account(s).${failed}`
          : `Synced ${symbolsSynced}/${symbolsRequested} symbols across ${usersSynced} account(s).`,
      });
    } catch (error) {
      const value = error as {
        response?: { data?: { message?: string; error?: { message?: string } } };
        message?: string;
      };
      setSyncResult({
        ok: false,
        message:
          value?.response?.data?.error?.message ??
          value?.response?.data?.message ??
          value?.message ??
          'SSI market sync failed',
      });
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
      const data = response.data as {
        ok?: boolean;
        error?: {
          message?: string;
          code?: string;
          details?: { transactionId?: string; action?: string };
        };
      };
      if (data?.ok) {
        setSsiOtpOpen(false);
        setSsiApprovalWaiting(false);
        setSsiTransactionId(undefined);
        await syncPortfolio();
        return;
      }
      const code = data?.error?.code;
      if (
        code === 'SSI_REAUTH_PENDING' ||
        code === 'SSI_APPROVAL_PENDING' ||
        /pending|not.*approv|waiting/i.test(data?.error?.message ?? '')
      ) {
        setSsiApprovalWaiting(true);
        setSsiOtpError(
          'SSI approval is still pending. Approve the request in the SSI app, then check again.'
        );
        return;
      }
      if (code === 'SSI_OTP_REQUIRED' || /otp/i.test(data?.error?.message ?? '')) {
        setSsiApprovalWaiting(false);
        setSsiOtpError(data?.error?.message ?? 'SSI requires an OTP.');
        return;
      }
      setSsiOtpError(data?.error?.message ?? 'SSI approval could not be verified.');
    } catch (error) {
      const value = error as {
        response?: { data?: { error?: { code?: string; message?: string }; message?: string } };
        message?: string;
      };
      const authError = value?.response?.data?.error;
      if (
        authError?.code === 'SSI_REAUTH_PENDING' ||
        authError?.code === 'SSI_APPROVAL_PENDING' ||
        /pending|not.*approv|waiting/i.test(authError?.message ?? '')
      ) {
        setSsiApprovalWaiting(true);
        setSsiOtpError(
          'SSI approval is still pending. Approve the request in the SSI app, then check again.'
        );
      } else {
        setSsiOtpError(
          authError?.message ??
            value?.response?.data?.message ??
            value?.message ??
            'SSI approval could not be verified.'
        );
      }
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
      const response = await platformApi.ssiApprove({
        environment: 'production',
        otp,
        ...(ssiTransactionId ? { transactionId: ssiTransactionId } : {}),
      });
      const data = response.data as { ok?: boolean; error?: { message?: string; code?: string } };
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
      const value = error as {
        response?: { data?: { message?: string; error?: { message?: string } } };
        message?: string;
      };
      setSsiOtpError(
        value?.response?.data?.error?.message ??
          value?.response?.data?.message ??
          value?.message ??
          'SSI OTP verification failed'
      );
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
        data?: {
          accountsSynced?: number;
          assetsSynced?: number;
          positionsSynced?: number;
          positionsClosed?: number;
          cashSynced?: number;
        };
      };
      const result = data?.data;
      if (!data?.ok) {
        const authError = data?.error;
        if (authError?.code === 'SSI_AUTH_REQUIRED') {
          setPortfolioResult({
            ok: false,
            message:
              'Open the SSI app and approve the sign-in request. OTP is only needed if SSI asks for it.',
          });
          openSsiApproval(authError.details);
          return;
        }
        setPortfolioResult({
          ok: false,
          message: authError?.message ?? 'SSI portfolio sync failed',
        });
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
      const value = error as {
        response?: {
          data?: {
            message?: string;
            error?: { code?: string; message?: string; details?: SsiAuthDetails };
          };
        };
        message?: string;
      };
      const authError = value?.response?.data?.error;
      if (authError?.code === 'SSI_AUTH_REQUIRED') {
        setPortfolioResult({
          ok: false,
          message:
            'Open the SSI app and approve the sign-in request. OTP is only needed if SSI asks for it.',
        });
        openSsiApproval(authError.details);
      } else {
        setPortfolioResult({
          ok: false,
          message:
            authError?.message ??
            value?.response?.data?.message ??
            value?.message ??
            'SSI portfolio sync failed',
        });
      }
    } finally {
      setSyncingPortfolio(false);
    }
  }

  return (
    <div className="engine-detail-page">
      <div className="page-heading">
        <div className="min-w-0">
          <div className="mb-3">
            <Link href="/engines" className="panel-action inline-flex items-center gap-2 text-sm">
              <ArrowLeft className="size-4" /> Back to engines
            </Link>
          </div>
          <p className="eyebrow">
            {engine.platform} · {engine.category}
          </p>
          <h1>{engine.name}</h1>
          <p className="page-subtitle">{engine.description}</p>
        </div>
      </div>
      {engine.id === 'ssi-execution' && (
        <>
          <Card className="panel-card mb-4">
            <CardContent className="space-y-3 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">SSI portfolio</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Sync all SSI sub-accounts, including Cash and Margin holdings, into the TCE
                    portfolio.
                  </p>
                </div>
                <Button
                  className="touch-target shrink-0"
                  disabled={syncingPortfolio}
                  onClick={() => void syncPortfolio()}
                >
                  <RefreshCw className={`size-4 ${syncingPortfolio ? 'animate-spin' : ''}`} />{' '}
                  {syncingPortfolio ? 'Syncing…' : 'Sync portfolio'}
                </Button>
              </div>
              {portfolioResult && (
                <div
                  className={`rounded-xl border px-3 py-2.5 text-xs ${portfolioResult.ok ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200' : 'border-red-300/15 bg-red-300/[0.05] text-red-200'}`}
                >
                  {portfolioResult.message}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="panel-card mb-4">
            <CardContent className="space-y-3 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">Market data</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Trigger the SSI market-price sync manually without waiting for the hourly
                    scheduler.
                  </p>
                </div>
                <Button
                  className="touch-target shrink-0"
                  disabled={syncing}
                  onClick={() => void syncMarketData()}
                >
                  <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />{' '}
                  {syncing ? 'Syncing…' : 'Sync market data'}
                </Button>
              </div>
              {syncResult && (
                <div
                  className={`rounded-xl border px-3 py-2.5 text-xs ${syncResult.ok ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200' : 'border-red-300/15 bg-red-300/[0.05] text-red-200'}`}
                >
                  {syncResult.message}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      <Card className="panel-card">
        <CardContent className="space-y-5 p-5 sm:p-6">
          {loading ? (
            <div className="text-sm text-muted">Loading engine configuration…</div>
          ) : (
            Object.entries(config).map(([key, value]) => (
              <label key={key} className="block">
                <span className="mb-2 block text-xs font-medium text-muted">{labelize(key)}</span>
                {typeof value === 'boolean' ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={value}
                    onClick={() => update(key, !value)}
                    className={`relative h-8 w-14 rounded-full p-1 transition ${value ? 'bg-emerald-500/80' : 'bg-white/10'}`}
                  >
                    <span
                      className={`block size-6 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : ''}`}
                    />
                  </button>
                ) : (
                  <input
                    type="number"
                    value={String(value)}
                    onChange={event => update(key, Number(event.target.value))}
                    className="h-12 w-full rounded-xl border border-violet-200/[0.08] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-violet-300/30"
                  />
                )}
              </label>
            ))
          )}
          <div className="flex items-center justify-between gap-3 border-t border-violet-200/[0.07] pt-5">
            {saved ? (
              <span className="text-xs text-emerald-300">Saved to backend</span>
            ) : (
              <span className="text-xs text-muted">Unsaved changes</span>
            )}
            <Button
              className="touch-target"
              disabled={loading || saved}
              onClick={() => void save()}
            >
              <Save className="size-4" /> Save
            </Button>
          </div>
        </CardContent>
      </Card>
      {ssiOtpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-violet-200/[0.10] bg-[#11111a] p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">SSI approval required</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {ssiApprovalWaiting
                    ? 'Open the SSI app and approve the sign-in request. Then return here and check the approval.'
                    : 'SSI requires an additional OTP. Enter the OTP sent by SSI.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSsiOtpOpen(false)}
                className="rounded-lg p-1.5 text-muted transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            {ssiApprovalWaiting ? (
              <>
                <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-3 text-xs text-amber-100">
                  Waiting for approval in SSI app…
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    className="touch-target"
                    disabled={ssiOtpLoading}
                    onClick={() => setSsiOtpOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    className="touch-target"
                    disabled={ssiOtpLoading || !ssiTransactionId}
                    onClick={() => void checkSsiApproval()}
                  >
                    <RefreshCw className={`size-4 ${ssiOtpLoading ? 'animate-spin' : ''}`} />{' '}
                    {ssiOtpLoading ? 'Checking…' : 'I approved — check'}
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
                    onKeyDown={event => {
                      if (event.key === 'Enter') void approveSsiOtp();
                    }}
                    placeholder="Enter OTP"
                    className="h-12 w-full rounded-xl border border-violet-200/[0.10] bg-white/[0.04] px-3 text-center text-lg tracking-[0.35em] text-white outline-none focus:border-violet-300/30"
                  />
                </label>
                {ssiOtpError && <p className="mt-2 text-xs text-red-300">{ssiOtpError}</p>}
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    className="touch-target"
                    disabled={ssiOtpLoading}
                    onClick={() => setSsiOtpOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="touch-target"
                    disabled={ssiOtpLoading || !ssiOtp.trim()}
                    onClick={() => void approveSsiOtp()}
                  >
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

function labelize(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase());
}
