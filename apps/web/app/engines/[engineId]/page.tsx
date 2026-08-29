'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { getEngine } from '../engine-registry';
import { dashboardApi, platformApi } from '../../../lib/api';

type ActionResult = { ok: boolean; message: string } | null;
type EngineConfig = Record<string, string | number | boolean>;

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

  if (!engine)
    return (
      <main className="app-shell">
        <div className="app-container app-content">
          <Card className="panel-card p-5">Engine not found.</Card>
        </div>
      </main>
    );

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

  async function syncPortfolio() {
    if (syncingPortfolio) return;
    setSyncingPortfolio(true);
    setPortfolioResult(null);
    try {
      const response = await platformApi.ssiSync({});
      const data = response.data as {
        ok?: boolean;
        error?: { message?: string };
        data?: {
          accountsSynced?: number;
          assetsSynced?: number;
          assetsZeroed?: number;
          positionsSynced?: number;
          positionsClosed?: number;
          cashSynced?: number;
        };
      };
      const result = data?.data;
      if (!data?.ok) {
        setPortfolioResult({
          ok: false,
          message: data?.error?.message ?? 'SSI portfolio sync failed',
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
        response?: { data?: { message?: string; error?: { message?: string } } };
        message?: string;
      };
      setPortfolioResult({
        ok: false,
        message:
          value?.response?.data?.error?.message ??
          value?.response?.data?.message ??
          value?.message ??
          'SSI portfolio sync failed',
      });
    } finally {
      setSyncingPortfolio(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-container app-header-inner">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/engines"
              className="touch-target grid place-items-center rounded-2xl border border-violet-200/[0.09] bg-white/[0.02] text-[#a88bb5]"
              aria-label="Back to engines"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <p className="eyebrow">
                {engine.platform} · {engine.category}
              </p>
              <p className="account-email">{engine.name}</p>
            </div>
          </div>
        </div>
      </header>
      <div className="app-container app-content">
        <div className="page-heading">
          <div className="min-w-0">
            <p className="eyebrow">Configuration</p>
            <h1>Engine detail</h1>
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
                    <p className="mt-1 text-xs leading-5 text-[#75697d]">
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
                    <p className="mt-1 text-xs leading-5 text-[#75697d]">
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
              <div className="text-sm text-[#75697d]">Loading engine configuration…</div>
            ) : (
              Object.entries(config).map(([key, value]) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-xs font-medium text-[#a99bae]">
                    {labelize(key)}
                  </span>
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
                <span className="text-xs text-[#75697d]">Unsaved changes</span>
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
      </div>
    </main>
  );
}
function labelize(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase());
}
