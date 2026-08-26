'use client';

import { useEffect, useState } from 'react';
import { Activity, ChevronRight, Layers3, LogOut, RefreshCw, Settings2, ShoppingCart, TrendingUp, WalletCards } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import PlatformConfigTab from '../../components/config/PlatformConfigTab';
import { useAuthStore, useDashboardStore } from '../../lib/store';

type Tab = 'overview' | 'positions' | 'orders' | 'config';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, initialized, init, logout } = useAuthStore();
  const { data, loading, error, load } = useDashboardStore();
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => { void init(); }, [init]);
  useEffect(() => { if (initialized && !user) router.replace('/login'); }, [initialized, user, router]);
  useEffect(() => { if (user) void load(); }, [user, load]);

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
          <Button variant="outline" size="sm" onClick={async () => { await logout(); router.replace('/login'); }}><LogOut className="size-4" /><span className="hidden sm:inline">Sign out</span></Button>
        </div>
        <Tabs value={tab} onValueChange={v=>setTab(v as Tab)} className="mt-4">
          <TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="positions">Positions</TabsTrigger><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="config"><Settings2 className="mr-1.5 size-4"/>Config</TabsTrigger></TabsList>
        </Tabs>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 sm:pt-7">
      {tab !== 'config' && <section className="mb-5 flex items-end justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#887b91]">Portfolio</p><h1 className="mt-1 text-[24px] font-semibold tracking-[-.035em] sm:text-3xl">Investigate value / total</h1></div><Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh dashboard"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></Button></section>}

      {tab !== 'config' && <Card className="mb-5"><CardContent className="p-5"><p className="text-xs text-[#8e8197]">Total portfolio value</p><p className="mt-2 text-3xl font-semibold tracking-tight">{money(account.totalValue ?? account.portfolioValue ?? account.equity)}</p><p className="mt-2 text-sm text-zinc-500">Investigate deployed capital and recovery state from the live account.</p></CardContent></Card>}

      {tab === 'overview' && <div className="grid gap-4 lg:grid-cols-2"><Panel title="Current Positions" icon={WalletCards}><List rows={positions} /></Panel><Panel title="Shared Pools" icon={Layers3}><List rows={pools} /></Panel><Panel title="Next Positions" icon={TrendingUp}><List rows={next} /></Panel><Panel title="Recent Orders" icon={ShoppingCart}><List rows={orders} /></Panel></div>}
      {tab === 'positions' && <DataTable rows={positions} columns={['symbol', 'quantity', 'avgBuyCost', 'marketPrice', 'unrealizedPnl']} />}
      {tab === 'orders' && <DataTable rows={orders} columns={['side', 'symbol', 'quantity', 'price', 'status', 'fee', 'tax']} />}
      {tab === 'config' && <PlatformConfigTab />}
      {error && <div className="mt-4 rounded-xl border border-red-300/15 bg-red-300/[0.06] px-4 py-3 text-sm text-red-200">{error}</div>}
    </div>
  </main>;
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Layers3; children: React.ReactNode }) { return <Card><div className="p-4 sm:p-5"><header className="mb-4 flex items-center gap-2"><Icon className="size-4 text-[#a88bb5]" /><h2 className="font-semibold tracking-tight">{title}</h2></header>{children}</div></Card>; }
function List({ rows }: { rows: any[] }) { if (!rows.length) return <Empty />; return <div className="divide-y divide-violet-200/[0.07]">{rows.slice(0, 8).map((row, i) => <div key={i} className="flex min-h-14 items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{String(row.symbol ?? row.name ?? row.code ?? `Item ${i + 1}`)}</p><p className="mt-1 text-xs text-[#81748a]">{String(row.status ?? row.type ?? row.quantity ?? '—')}</p></div><ChevronRight className="size-4 shrink-0 text-[#66596e]" /></div>)}</div>; }
function DataTable({ rows, columns }: { rows: any[]; columns: string[] }) { return <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-violet-200/[0.07] text-[10px] uppercase tracking-[.1em] text-[#81748a]"><tr>{columns.map(column=><th key={column} className="px-4 py-3 font-semibold">{column}</th>)}</tr></thead><tbody className="divide-y divide-violet-200/[0.07]">{rows.map((row,i)=><tr key={i}>{columns.map(column=><td key={column} className="whitespace-nowrap px-4 py-3 text-[#d8cedd]">{String(row?.[column] ?? '—')}</td>)}</tr>)}</tbody></table></div>{!rows.length && <Empty />}</Card>; }
function Empty() { return <div className="py-10 text-center text-sm text-[#75697d]">No data yet</div>; }
function Loading() { return <div className="rounded-2xl border border-violet-200/[0.08] bg-white/[0.03] p-5 text-sm text-[#81748a]">Checking secure session…</div>; }
function money(value: unknown) { if (value == null || value === '') return '—'; const n=Number(value); return Number.isFinite(n) ? n.toLocaleString('en-US',{maximumFractionDigits:0}) : String(value); }
