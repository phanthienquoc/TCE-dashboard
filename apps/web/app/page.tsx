'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, ChevronRight, CircleDollarSign, Layers3, LogOut, RefreshCw, ShieldCheck, ShoppingCart, TrendingUp, WalletCards } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useDashboardStore } from '../lib/store';
import { useUIStore } from '../lib/ui-store';

const SSIPlatform=dynamic(()=>import('./components/platforms/SSIPlatform'),{ssr:false,loading:()=> <LoadingCard label="Loading SSI…"/>});
const BinanceExecution=dynamic(()=>import('./components/platforms/BinanceExecution'),{ssr:false,loading:()=> <LoadingCard label="Loading Binance…"/>});
const tabs=[['Overview',BarChart3],['Positions',Layers3],['Recent Orders',ShoppingCart],['Trading Platforms',Activity],['Security',ShieldCheck]] as const;
type Tab=typeof tabs[number][0];

export default function Dashboard(){
  const router=useRouter();
  const {user,loading:initLoading,initialized,init,logout}=useAuthStore();
  const {data,loading,error,load}=useDashboardStore();
  const tab=useUIStore(s=>s.activeTab);
  const setTab=useUIStore(s=>s.setActiveTab);
  const binanceEnv=useUIStore(s=>s.binanceEnvironment);
  const setBinanceEnv=useUIStore(s=>s.setBinanceEnvironment);
  const [message,setMessage]=useState('');

  useEffect(()=>{init()},[init]);
  useEffect(()=>{if(initialized&&!user)router.replace('/login')},[initialized,user,router]);
  useEffect(()=>{if(user){load();const t=setInterval(load,30000);return()=>clearInterval(t)}},[user,load]);

  if(initLoading||!initialized||!user)return <main className="dashboard-shell min-h-svh bg-[#070b12] p-4 sm:p-6"><LoadingCard label="Checking secure session…"/></main>;

  const positions=data?.positions??data?.currentPositions??[];
  const orders=data?.orders??data?.recentOrders??[];
  const pools=data?.pools??[];
  const next=data?.nextPositions??data?.candidates??[];
  const account=data?.account??{};
  const invested=account?.investedCapital!=null?account.investedCapital:null;
  const total=account?.totalValue??account?.portfolioValue??account?.equity??null;
  const pnl=account?.unrealizedPnl??account?.pnl??null;

  const nav=useMemo(()=>tabs.filter(([label])=>label!=='Trading Platforms'),[]);
  const selectTab=(value:Tab)=>{setTab(value);window.scrollTo({top:0,behavior:'smooth'})};

  return <main className="dashboard-shell min-h-svh overflow-x-clip bg-[#070b12] text-slate-100">
    <header className="dashboard-header sticky top-0 z-40 border-b border-white/[0.08] bg-[#070b12]/92 backdrop-blur-xl">
      <div className="dashboard-container flex min-h-14 items-center justify-between gap-3 px-4 py-2 sm:min-h-16 sm:px-6">
        <div className="min-w-0"><div className="flex items-center gap-2"><div className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-slate-950"><Activity className="size-4"/></div><h1 className="truncate text-base font-semibold tracking-tight">TCE</h1></div><p className="hidden truncate pl-10 text-xs text-slate-500 sm:block">Treasury Cash Extraction</p></div>
        <button onClick={async()=>{await logout();router.replace('/login')}} aria-label="Sign out" className="touch-target inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.08] active:scale-[.98]"><LogOut className="size-4"/><span className="hidden sm:inline">Sign out</span></button>
      </div>
    </header>
    <div className="dashboard-container px-4 pb-[calc(92px+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-10 sm:pt-7">
      <section className="mb-5 sm:mb-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">Portfolio</p><h2 className="mt-1 text-[25px] font-semibold leading-tight tracking-[-.03em] sm:text-3xl">Investigate value / total</h2><p className="mt-1 truncate text-xs text-slate-500">{user.email}</p></div><button onClick={load} disabled={loading} aria-label="Refresh dashboard" className="touch-target inline-flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 shadow-sm transition hover:bg-white/[0.08] disabled:opacity-50"><RefreshCw className={`size-4 ${loading?'animate-spin':''}`}/></button></div></section>
      <section className="mb-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]"><section className="hero-card rounded-2xl border border-white/[0.1] bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,.09),transparent_42%),linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.025))] p-4 shadow-2xl shadow-black/20 sm:p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-medium text-slate-400">Portfolio value</p><p className="mt-2 truncate text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{formatMoney(total??invested)}</p><p className="mt-2 text-xs text-slate-500">{invested!=null?`Invested ${formatMoney(invested)}`:'Value not available yet'}</p></div><div className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05]"><CircleDollarSign className="size-5 text-slate-300"/></div></div><div className="mt-5 flex items-center gap-2 text-sm"><span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-slate-400">{positions.length} active positions</span><span className={Number(pnl)>=0?'text-emerald-300':'text-rose-300'}>{pnl!=null?formatMoney(pnl):'P&L —'}</span></div></section><section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2"><Metric label="Pools" value={pools.length} icon={Layers3}/><Metric label="Positions" value={positions.length} icon={WalletCards}/><Metric label="Next" value={next.length} icon={TrendingUp}/><Metric label="Orders" value={orders.length} icon={ShoppingCart}/></section></section>
      <div className="desktop-tabs mb-5 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.025] p-1 backdrop-blur-xl"><nav className="flex min-w-max gap-1" aria-label="Dashboard sections">{tabs.map(([label,Icon])=><button key={label} onClick={()=>selectTab(label)} className={`touch-target inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition active:scale-[.98] sm:text-sm ${tab===label?'bg-white text-slate-950 shadow-sm':'text-slate-500 hover:bg-white/[0.06] hover:text-slate-200'}`}><Icon className="size-4"/><span>{label}</span></button>)}</nav></div>
      {message&&<div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-300">{message}</div>}
      {tab==='Overview'&&<section className="grid gap-4 lg:grid-cols-2"><Panel title="Shared Pools" subtitle="Capital allocation overview"><List items={pools}/></Panel><Panel title="Next Positions" subtitle="Candidates queued for the next cycle"><List items={next}/></Panel></section>}
      {tab==='Positions'&&<DataTable rows={positions} columns={['symbol','quantity','avgBuyCost','marketPrice','cycleNumber','unrealizedPnl']}/>} {tab==='Recent Orders'&&<DataTable rows={orders} columns={['side','symbol','quantity','price','status','fee','tax']}/>} {tab==='Trading Platforms'&&<div className="grid gap-4 lg:grid-cols-2"><SSIPlatform onMessage={setMessage}/><BinanceExecution environment={binanceEnv} onEnvironment={setBinanceEnv} onMessage={setMessage}/></div>} {tab==='Security'&&<Panel title="Security" subtitle="Session and credential handling"><div className="flex gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-400"/><div><p className="font-medium text-emerald-300">Session protected</p><p className="mt-1 text-sm leading-6 text-emerald-200/70">JWT is attached centrally. Expired access tokens are refreshed once; refresh failure clears the session.</p></div></div><p className="mt-4 text-sm leading-6 text-slate-500">Credential material is submitted to the backend and is not rendered from saved configuration.</p></Panel>}
      {loading&&<p className="mt-4 text-center text-xs text-slate-600">Refreshing dashboard…</p>}{error&&<div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>}
    </div>
    <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-[#070b12]/95 px-2 pt-2 backdrop-blur-xl" aria-label="Mobile navigation"><div className="mx-auto grid max-w-md grid-cols-4 gap-1 pb-[calc(8px+env(safe-area-inset-bottom))]">{nav.map(([label,Icon])=><button key={label} onClick={()=>selectTab(label)} aria-current={tab===label?'page':undefined} className={`touch-target flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition active:scale-[.97] ${tab===label?'bg-white text-slate-950':'text-slate-500'}`}><Icon className="size-4"/><span>{label==='Recent Orders'?'Orders':label}</span></button>)}</div></nav>
  </main>
}
function Metric({label,value,icon:Icon}:{label:string;value:number;icon:React.ComponentType<{className?:string}>}){return <div className="metric-card rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3.5 sm:p-4"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</span><Icon className="size-4 text-slate-600"/></div><p className="mt-2 text-xl font-semibold tracking-tight">{value}</p></div>}
function Panel({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){return <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 shadow-xl shadow-black/10 sm:p-5"><header className="mb-4"><h3 className="font-semibold tracking-tight">{title}</h3><p className="mt-1 text-xs text-slate-500">{subtitle}</p></header>{children}</section>}
function List({items}:{items:any[]}){return items.length?<div className="divide-y divide-white/[0.06]">{items.map((x,i)=><div className="flex min-h-14 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" key={i}><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-200">{x.symbol??x.name??x.code??`Item ${i+1}`}</p><p className="text-xs text-slate-500">{x.status??x.type??'Position'}</p></div><div className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-300">{String(x.price??x.targetPrice??'—')}<ChevronRight className="size-4 text-slate-600"/></div></div>)}</div>:<Empty/>}
function DataTable({rows,columns}:{rows:any[];columns:string[]}){return <div className="data-table rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-xl shadow-black/10"><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-white/[0.025] text-[10px] uppercase tracking-[.1em] text-slate-500"><tr>{columns.map(c=><th className="px-4 py-3 font-semibold" key={c}>{c}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.06]">{rows.map((r,i)=><tr className="transition hover:bg-white/[0.025]" key={i}>{columns.map(c=><td className="whitespace-nowrap px-4 py-3 text-slate-300" key={c}>{String(r?.[c]??'—')}</td>)}</tr>)}</tbody></table></div><div className="md:hidden">{rows.length?<div className="divide-y divide-white/[0.06]">{rows.map((r,i)=><details key={i} className="group p-4"><summary className="list-none cursor-pointer"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium text-slate-200">{String(r?.symbol??r?.code??`Row ${i+1}`)}</p><p className="mt-1 text-xs text-slate-500">{String(r?.status??r?.side??'')}</p></div><ChevronRight className="size-4 shrink-0 text-slate-600 transition-transform group-open:rotate-90"/></div></summary><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">{columns.filter(c=>c!=='symbol').map(c=><div key={c} className="min-w-0"><dt className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-600">{c}</dt><dd className="mt-1 truncate text-sm text-slate-300">{String(r?.[c]??'—')}</dd></div>)}</dl></details>)}</div>:<Empty/>}</div></div>}
function Empty(){return <div className="py-10 text-center"><p className="text-sm font-medium text-slate-400">No data yet</p><p className="mt-1 text-xs text-slate-600">This section will populate when data is available.</p></div>}
function LoadingCard({label}:{label:string}){return <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5"><div className="flex items-center gap-3"><div className="size-5 animate-pulse rounded-full bg-white/10"/><span className="text-sm text-slate-500">{label}</span></div></div>}
function formatMoney(value:any){if(value==null||value==='')return '—';const n=Number(value);if(!Number.isFinite(n))return String(value);return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(n)}
