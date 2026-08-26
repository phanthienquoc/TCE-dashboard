'use client';

import { useEffect } from 'react';
import { RefreshCw, Wallet, Layers3, TrendingUp, ShoppingCart, Activity, ShieldCheck } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuthStore, useDashboardStore } from '../lib/store';

const SSIPlatform = dynamic(() => import('../app/components/platforms/SSIPlatform'), { ssr: false });
const BinanceExecution = dynamic(() => import('../app/components/platforms/BinanceExecution'), { ssr: false });

export default function DashboardPage() {
  const router = useRouter();
  const { user, initialized, loading: authLoading, init, logout } = useAuthStore();
  const { data, loading, error, load } = useDashboardStore();

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (initialized && !user) router.replace('/login');
  }, [initialized, user, router]);
  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  if (authLoading || !initialized || !user) {
    return <main className="min-h-svh bg-[#070b12] text-slate-100 grid place-items-center">Loading session…</main>;
  }

  const positions = data?.positions ?? data?.currentPositions ?? [];
  const pools = data?.pools ?? [];
  const next = data?.nextPositions ?? data?.candidates ?? [];
  const orders = data?.orders ?? data?.recentOrders ?? [];
  const account = data?.account ?? {};

  return (
    <main className="min-h-svh bg-[#070b12] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#070b12]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-white text-slate-950"><Activity className="size-4" /></div>
            <div className="min-w-0">
              <h1 className="truncate font-semibold tracking-tight">TCE</h1>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <button onClick={async () => { await logout(); router.replace('/login'); }} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">Sign out</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
        <section className="mb-5 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 shadow-xl shadow-black/10 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Portfolio</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Investigate Value / Total</h2>
              <p className="mt-2 text-sm text-slate-500">{account?.investedCapital != null ? String(account.investedCapital) : '—'}</p>
            </div>
            <button onClick={load} disabled={loading} aria-label="Refresh" className="grid size-11 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300">
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Current Positions" icon={Wallet}>
            <List rows={positions} primary="symbol" secondary="quantity" />
          </Panel>
          <Panel title="Shared Pools" icon={Layers3}>
            <List rows={pools} primary="symbol" secondary="status" />
          </Panel>
          <Panel title="Next Positions" icon={TrendingUp}>
            <List rows={next} primary="symbol" secondary="targetPrice" />
          </Panel>
          <Panel title="Recent Orders" icon={ShoppingCart}>
            <List rows={orders} primary="symbol" secondary="status" />
          </Panel>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="SSI FastConnect" icon={ShieldCheck}>
            <SSIPlatform onMessage={() => undefined} />
          </Panel>
          <Panel title="Binance Execution" icon={Activity}>
            <BinanceExecution environment="testnet" onEnvironment={() => undefined} onMessage={() => undefined} />
          </Panel>
        </section>

        {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      </div>
    </main>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Wallet; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-xl shadow-black/10">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-4 sm:px-5">
        <Icon className="size-4 text-slate-500" />
        <h3 className="font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function List({ rows, primary, secondary }: { rows: any[]; primary: string; secondary: string }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-slate-600">No data yet</p>;
  return <div className="divide-y divide-white/[0.06]">{rows.map((row, index) => (
    <div key={index} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="truncate text-sm font-medium text-slate-200">{String(row?.[primary] ?? row?.name ?? `Item ${index + 1}`)}</span>
      <span className="shrink-0 text-xs text-slate-500">{String(row?.[secondary] ?? '—')}</span>
    </div>
  ))}</div>;
}
