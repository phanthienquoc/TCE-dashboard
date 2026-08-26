'use client';

import { useEffect, useState } from 'react';
import { Activity, ChevronRight, Layers3, LogOut, RefreshCw, ShoppingCart, TrendingUp, WalletCards } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SSIPlatform from '../components/platforms/SSIPlatform';
import { useAuthStore, useDashboardStore } from '../../lib/store';

type Tab = 'Overview' | 'Positions' | 'Orders';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, initialized, init, logout } = useAuthStore();
  const { data, loading, error, load } = useDashboardStore();
  const [tab, setTab] = useState<Tab>('Overview');
  const [platformMessage, setPlatformMessage] = useState('');

  useEffect(() => { void init(); }, [init]);
  useEffect(() => { if (initialized && !user) router.replace('/login'); }, [initialized, user, router]);
  useEffect(() => { if (!user) return; void load(); }, [user, load]);

  if (authLoading || !initialized || !user) return <main className="min-h-svh bg-[#090510] p-5 text-white"><Loading /></main>;

  const account = data?.account ?? {};
  const positions = data?.positions ?? data?.currentPositions ?? [];
  const pools = data?.pools ?? [];
  const next = data?.nextPositions ?? data?.candidates ?? [];
  const orders = data?.orders ?? data?.recentOrders ?? [];

  return <main className="min-h-svh overflow-x-clip bg-[#090510] text-[#f4effa]">
    <header className="sticky top-0 z-40 border-b border-violet-200/[0.08] bg-[#0b0611]/95 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#d69cff] to-[#7d37c9]"><Activity className="size-4" /></div><div className="min-w-0"><p className="text-[10px] uppercase tracking-[.14em] text-[#9d8fa8]">TCE account</p><p className="truncate text-sm font-semibold">{user.email}</p></div></div>
          <button onClick={async () => { await logout(); router.replace('/login'); }} className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200/10 px-3 text-xs font-semibold text-[#c9bed3]"><LogOut className="size-4" /><span className="hidden sm:inline">Sign out</span></button>
        </div>
        <nav className="mt-4 flex gap-6 border-b border-violet-200/[0.08] text-sm font-medium text-[#8e8299]">{(['Overview', 'Positions', 'Orders'] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`relative min-h-10 ${tab === item ? 'text-white' : ''}`}>{item}{tab === item && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-[#c06cff]" />}</button>)}</nav>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 sm:pt-7">
      <section className="mb-5 flex items-end justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#887b91]">Portfolio</p><h1 className="mt-1 text-[24px] font-semibold tracking-[-.035em] sm:text-3xl">Investigate value / total</h1></div><button onClick={() => void load()} disabled={loading} aria-label="Refresh dashboard" className="grid size-11 place-items-center rounded-xl border border-violet-200/10 bg-[#17101d] text-[#bcaec6] disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button></section>

      <section className="mb-5 rounded-[22px] border border-violet-200/[0.09] bg-[#150d1d] p-5 shadow-[0_18px_50px_rgba(0,0,0,.2)]"><p className="text-xs text-[#8e8197]">Total portfolio value</p><p className="mt-2 text-3xl font-semibold tracking-tight">{money(account.totalValue ?? account.portfolioValue ?? account.equity)}</p><div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4"><Metric label="Invested" value={money(account.investedCapital)} /><Metric label="P&L" value={money(account.unrealizedPnl ?? account.pnl)} /><Metric label="Positions" value={String(positions.length)} /><Metric label="Pools" value={String(pools.length)} /></div></section>

      <SSIPlatform onMessage={setPlatformMessage} />
      {platformMessage && <div className="-mt-2 mb-4 rounded-xl border border-violet-200/[0.07] bg-[#110a17] px-4 py-2 text-xs text-[#9e91a8]" role="status">{platformMessage}</div>}

      {tab === 'Overview' && <div className="grid gap-4 lg:grid-cols-2"><Panel title="Current Positions" icon={WalletCards}><List rows={positions} /></Panel><Panel title="Shared Pools" icon={Layers3}><List rows={pools} /></Panel><Panel title="Next Positions" icon={TrendingUp}><List rows={next} /></Panel><Panel title="Recent Orders" icon={ShoppingCart}><List rows={orders} /></Panel></div>}
      {tab === 'Positions' && <DataTable rows={positions} columns={['symbol', 'quantity', 'avgBuyCost', 'marketPrice', 'unrealizedPnl']} />}
      {tab === 'Orders' && <DataTable rows={orders} columns={['side', 'symbol', 'quantity', 'price', 'status', 'fee', 'tax']} />}
      {error && <div className="mt-4 rounded-xl border border-red-300/15 bg-red-300/[0.06] px-4 py-3 text-sm text-red-200">{error}</div>}
    </div>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] uppercase tracking-[.12em] text-[#81748a]">{label}</p><p className="mt-1 truncate text-base font-semibold">{value}</p></div>; }
function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Layers3; children: React.ReactNode }) { return <section className="rounded-[22px] border border-violet-200/[0.08] bg-[#150d1d] p-4 shadow-[0_14px_40px_rgba(0,0,0,.16)] sm:p-5"><header className="mb-4 flex items-center gap-2"><Icon className="size-4 text-[#a88bb5]" /><h2 className="font-semibold tracking-tight">{title}</h2></header>{children}</section>; }
function List({ rows }: { rows: any[] }) { if (!rows.length) return <Empty />; return <div className="divide-y divide-violet-200/[0.07]">{rows.slice(0, 8).map((row, i) => <div key={i} className="flex min-h-14 items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{String(row.symbol ?? row.name ?? row.code ?? `Item ${i + 1}`)}</p><p className="mt-1 text-xs text-[#81748a]">{String(row.status ?? row.type ?? row.quantity ?? '—')}</p></div><ChevronRight className="size-4 shrink-0 text-[#66596e]" /></div>)}</div>; }
function DataTable({ rows, columns }: { rows: any[]; columns: string[] }) { return <section className="overflow-hidden rounded-[22px] border border-violet-200/[0.08] bg-[#150d1d]"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-violet-200/[0.07] text-[10px] uppercase tracking-[.1em] text-[#81748a]"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}</tr></thead><tbody className="divide-y divide-violet-200/[0.07]">{rows.map((row, i) => <tr key={i}>{columns.map((column) => <td key={column} className="whitespace-nowrap px-4 py-3 text-[#d8cedd]">{String(row?.[column] ?? '—')}</td>)}</tr>)}</tbody></table></div>{!rows.length && <Empty />}</section>; }
function Empty() { return <div className="py-10 text-center text-sm text-[#75697d]">No data yet</div>; }
function Loading() { return <div className="rounded-2xl border border-violet-200/[0.08] bg-white/[0.03] p-5 text-sm text-[#81748a]">Checking secure session…</div>; }
function money(value: unknown) { if (value == null || value === '') return '—'; const n = Number(value); return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(value); }
