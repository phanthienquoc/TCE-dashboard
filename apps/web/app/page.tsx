'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, ChevronDown, ChevronRight, CircleDollarSign, Grid2x2, Layers3, LogOut, MoreHorizontal, RefreshCw, ShieldCheck, ShoppingCart, TrendingUp, WalletCards } from 'lucide-react';
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
  const [mobileMore,setMobileMore]=useState(false);

  useEffect(()=>{init()},[init]);
  useEffect(()=>{if(initialized&&!user)router.replace('/login')},[initialized,user,router]);
  useEffect(()=>{if(user){load();const t=setInterval(load,30000);return()=>clearInterval(t)}},[user,load]);

  if(initLoading||!initialized||!user)return <main className="dashboard-shell min-h-svh bg-[#090510] p-4"><LoadingCard label="Checking secure session…"/></main>;

  const positions=data?.positions??data?.currentPositions??[];
  const orders=data?.orders??data?.recentOrders??[];
  const pools=data?.pools??[];
  const next=data?.nextPositions??data?.candidates??[];
  const account=data?.account??{};
  const invested=account?.investedCapital!=null?account.investedCapital:null;
  const total=account?.totalValue??account?.portfolioValue??account?.equity??null;
  const pnl=account?.unrealizedPnl??account?.pnl??null;
  const pnlPct=account?.pnlPercent??account?.returnPercent??null;
  const allocation=buildAllocation(positions);
  const nav=[['Overview',BarChart3],['Positions',Layers3],['Recent Orders',ShoppingCart],['Security',ShieldCheck]] as const;

  const selectTab=(value:Tab)=>{setTab(value);setMobileMore(false);window.scrollTo({top:0,behavior:'smooth'})};
  const refresh=()=>load();

  return <main className="dashboard-shell min-h-svh overflow-x-clip bg-[#090510] text-[#f4effa]">
    <header className="dashboard-header sticky top-0 z-40 border-b border-violet-200/[0.08] bg-[#0b0611]/90 backdrop-blur-2xl">
      <div className="dashboard-container px-4 pb-3 pt-[max(10px,env(safe-area-inset-top))] sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <button className="group flex min-w-0 items-center gap-2 text-left" aria-label="Account">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#d69cff] to-[#7d37c9] shadow-[0_0_28px_rgba(184,108,255,.28)]"><Activity className="size-4 text-white"/></div>
            <div className="min-w-0"><p className="text-[10px] font-medium uppercase tracking-[.14em] text-[#9d8fa8]">TCE account</p><p className="truncate text-sm font-semibold">{user.email}<ChevronDown className="ml-1 inline size-3 text-[#b86cff]"/></p></div>
          </button>
          <button onClick={async()=>{await logout();router.replace('/login')}} aria-label="Sign out" className="touch-target inline-flex items-center gap-2 rounded-xl border border-violet-200/10 bg-white/[0.035] px-3 text-xs font-semibold text-[#c9bed3] active:scale-[.98]"><LogOut className="size-4"/><span className="hidden sm:inline">Sign out</span></button>
        </div>
        <div className="mt-4 flex gap-6 overflow-x-auto border-b border-violet-200/[0.08] text-sm font-medium text-[#8e8299] sm:mt-5">
          {(['Overview','Positions','Recent Orders'] as Tab[]).map(label=><button key={label} onClick={()=>selectTab(label)} className={`relative min-h-11 shrink-0 px-1 ${tab===label?'text-white':''}`}>{label==='Recent Orders'?'Orders':label}{tab===label&&<span className="absolute inset-x-0 bottom-[-1px] h-0.5 rounded-full bg-[#c06cff] shadow-[0_0_12px_rgba(192,108,255,.7)]"/>}</button>)}
          <button onClick={()=>setMobileMore(v=>!v)} className={`min-h-11 shrink-0 px-1 ${mobileMore?'text-white':''}`}>More</button>
        </div>
        {mobileMore&&<div className="mt-2 flex gap-2 pb-1 sm:hidden"><button onClick={()=>selectTab('Trading Platforms')} className="touch-target rounded-xl border border-violet-200/10 bg-[#191020] px-3 text-xs font-semibold text-[#cbb9d8]">Trading Platforms</button><button onClick={()=>selectTab('Security')} className="touch-target rounded-xl border border-violet-200/10 bg-[#191020] px-3 text-xs font-semibold text-[#cbb9d8]">Security</button></div>}
      </div>
    </header>

    <div className="dashboard-container px-4 pb-[calc(102px+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-10 sm:pt-7">
      <section className="mb-4 flex items-end justify-between gap-3 sm:mb-6">
        <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#887b91]">Portfolio</p><h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-.035em] sm:text-3xl">Investigate value / total</h2></div>
        <button onClick={refresh} disabled={loading} aria-label="Refresh dashboard" className="touch-target inline-flex shrink-0 items-center justify-center rounded-xl border border-violet-200/10 bg-[#17101d] text-[#bcaec6] shadow-lg shadow-black/20 active:scale-[.96] disabled:opacity-50"><RefreshCw className={`size-4 ${loading?'animate-spin':''}`}/></button>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Invested capital" value={formatMoney(invested)} />
        <StatCard label="Portfolio value" value={formatMoney(total)} />
        <StatCard label="Portfolio P&L" value={formatMoney(pnl)} tone={Number(pnl)>=0?'positive':'negative'} />
        <StatCard label="Return" value={pnlPct!=null?`${formatNumber(pnlPct)}%`:'—'} tone={Number(pnlPct)>=0?'positive':'negative'} />
      </section>

      <section className="mb-6 rounded-[22px] border border-violet-200/[0.09] bg-[#150d1d] p-4 shadow-[0_18px_50px_rgba(0,0,0,.2)] sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold tracking-tight">Portfolio</h3><p className="mt-0.5 text-xs text-[#8e8197]">Allocation by active position</p></div><span className="rounded-full bg-[#24132f] px-2.5 py-1 text-[10px] font-semibold text-[#bda9ca]">{positions.length} positions</span></div>
        <div className="mt-5 flex flex-col items-center sm:flex-row sm:justify-center sm:gap-10">
          <div className="relative grid size-48 shrink-0 place-items-center rounded-full" style={{background:allocation.gradient}}><div className="grid size-28 place-items-center rounded-full bg-[#150d1d] shadow-[0_0_0_8px_rgba(21,13,29,.35)]"><div className="text-center"><p className="text-[10px] uppercase tracking-[.12em] text-[#887b91]">Invested</p><p className="mt-1 text-base font-semibold">{formatMoney(invested)}</p></div></div></div>
          <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-x-5 gap-y-3 sm:mt-0">{allocation.items.length?allocation.items.slice(0,6).map((x)=><div key={x.symbol} className="flex min-w-0 items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{background:x.color}}/><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#d9cfdf]">{x.symbol}</p><p className="text-[11px] text-[#8e8197]">{x.percent.toFixed(1)}%</p></div></div>):<p className="col-span-2 text-center text-xs text-[#75697d]">No allocation data yet.</p>}</div>
        </div>
      </section>

      {tab==='Overview'&&<section className="space-y-4"><Panel title="Shared Pools" subtitle="Capital allocation overview"><List items={pools}/></Panel><Panel title="Next Positions" subtitle="Candidates queued for the next cycle"><List items={next}/></Panel></section>}
      {tab==='Positions'&&<PositionList rows={positions}/>} 
      {tab==='Recent Orders'&&<DataTable rows={orders} columns={['side','symbol','quantity','price','status','fee','tax']}/>} 
      {tab==='Trading Platforms'&&<div className="grid gap-4 lg:grid-cols-2"><SSIPlatform onMessage={setMessage}/><BinanceExecution environment={binanceEnv} onEnvironment={setBinanceEnv} onMessage={setMessage}/></div>}
      {tab==='Security'&&<Panel title="Security" subtitle="Session and credential handling"><div className="flex gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300"/><div><p className="font-medium text-emerald-200">Session protected</p><p className="mt-1 text-sm leading-6 text-emerald-200/60">JWT is attached centrally. Expired access tokens are refreshed once; refresh failure clears the session.</p></div></div></Panel>}
      {message&&<div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-3 text-sm font-medium text-emerald-200">{message}</div>}
      {loading&&<p className="mt-4 text-center text-xs text-[#75697d]">Refreshing dashboard…</p>}{error&&<div className="mt-4 rounded-2xl border border-red-300/15 bg-red-300/[0.06] px-4 py-3 text-sm text-red-200">{error}</div>}
    </div>

    <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-violet-200/[0.08] bg-[#130b1a]/95 px-2 pt-2 shadow-[0_-12px_40px_rgba(0,0,0,.28)] backdrop-blur-2xl" aria-label="Mobile navigation">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 pb-[calc(7px+env(safe-area-inset-bottom))]">
        {nav.slice(0,2).map(([label,Icon])=><BottomItem key={label} label={label} icon={Icon} active={tab===label} onClick={()=>selectTab(label)}/>)}
        <button onClick={refresh} aria-label="Refresh dashboard" className="relative -mt-7 flex min-h-16 flex-col items-center justify-center gap-1"><span className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-[#d17dff] to-[#8737d0] text-white shadow-[0_8px_28px_rgba(184,108,255,.4)] ring-[6px] ring-[#130b1a] active:scale-95"><RefreshCw className={`size-6 ${loading?'animate-spin':''}`}/></span><span className="text-[10px] font-semibold text-[#a895ad]">Refresh</span></button>
        <BottomItem label="Orders" icon={ShoppingCart} active={tab==='Recent Orders'} onClick={()=>selectTab('Recent Orders')}/>
        <button onClick={()=>setMobileMore(v=>!v)} className={`touch-target flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${mobileMore?'text-[#cf7aff]':'text-[#91849a]'}`}><Grid2x2 className="size-5"/><span>More</span></button>
      </div>
    </nav>
  </main>
}

function BottomItem({label,icon:Icon,active,onClick}:{label:string;icon:React.ComponentType<{className?:string}>;active:boolean;onClick:()=>void}){return <button onClick={onClick} aria-current={active?'page':undefined} className={`touch-target flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${active?'text-[#d080ff]':'text-[#91849a]'}`}><Icon className="size-5"/><span>{label}</span></button>}
function StatCard({label,value,tone='default'}:{label:string;value:string;tone?:'default'|'positive'|'negative'}){return <article className="rounded-[18px] border border-violet-200/[0.08] bg-[#1a1222] px-3.5 py-3.5 shadow-[0_8px_28px_rgba(0,0,0,.14)] sm:px-4 sm:py-4"><p className="text-[11px] font-medium text-[#91849b] sm:text-xs">{label}</p><p className={`mt-2 truncate text-[20px] font-semibold tracking-[-.025em] sm:text-2xl ${tone==='positive'?'text-[#61e5ad]':tone==='negative'?'text-[#ff6269]':'text-[#f1ebf5]'}`}>{value}</p></article>}
function Panel({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){return <section className="rounded-[22px] border border-violet-200/[0.08] bg-[#150d1d] p-4 shadow-[0_14px_40px_rgba(0,0,0,.16)] sm:p-5"><header className="mb-4"><h3 className="text-lg font-semibold tracking-tight">{title}</h3><p className="mt-0.5 text-xs text-[#8e8197]">{subtitle}</p></header>{children}</section>}
function List({items}:{items:any[]}){return items.length?<div className="divide-y divide-violet-200/[0.07]">{items.map((x,i)=><div className="flex min-h-16 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" key={i}><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#e5ddea]">{x.symbol??x.name??x.code??`Item ${i+1}`}</p><p className="mt-1 text-xs text-[#82758b]">{x.status??x.type??'Position'}</p></div><div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-[#c7b9cf]">{String(x.price??x.targetPrice??'—')}<ChevronRight className="size-4 text-[#66596e]"/></div></div>)}</div>:<Empty/>}
function PositionList({rows}:{rows:any[]}){return rows.length?<div className="space-y-2.5">{rows.map((r,i)=><article key={i} className="rounded-[18px] border border-violet-200/[0.08] bg-[#150d1d] px-4 py-3.5 shadow-[0_8px_28px_rgba(0,0,0,.13)]"><div className="flex items-start justify-between gap-3"><div><p className="text-base font-semibold">{String(r?.symbol??r?.code??`Position ${i+1}`)}</p><p className="mt-1 text-[11px] text-[#82758b]">Qty {String(r?.quantity??'—')} · Avg {String(r?.avgBuyCost??'—')}</p></div><div className={`text-right text-sm font-semibold ${Number(r?.unrealizedPnl)>=0?'text-[#61e5ad]':'text-[#ff6269]'}`}>{formatMoney(r?.unrealizedPnl)}<p className="mt-1 text-[11px] font-normal text-[#82758b]">Market {String(r?.marketPrice??'—')}</p></div></div></article>)}</div>:<Empty/>}
function DataTable({rows,columns}:{rows:any[];columns:string[]}){return <div className="rounded-[22px] border border-violet-200/[0.08] bg-[#150d1d] shadow-[0_14px_40px_rgba(0,0,0,.16)]"><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-white/[0.025] text-[10px] uppercase tracking-[.1em] text-[#82758b]"><tr>{columns.map(c=><th className="px-4 py-3 font-semibold" key={c}>{c}</th>)}</tr></thead><tbody className="divide-y divide-violet-200/[0.06]">{rows.map((r,i)=><tr className="hover:bg-white/[0.025]" key={i}>{columns.map(c=><td className="whitespace-nowrap px-4 py-3 text-[#cfc3d6]" key={c}>{String(r?.[c]??'—')}</td>)}</tr>)}</tbody></table></div><div className="md:hidden">{rows.length?<div className="divide-y divide-violet-200/[0.06]">{rows.map((r,i)=><details key={i} className="group p-4"><summary className="list-none"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-[#e5ddea]">{String(r?.symbol??r?.code??`Order ${i+1}`)}</p><p className="mt-1 text-xs text-[#82758b]">{String(r?.status??r?.side??'')}</p></div><ChevronRight className="size-4 text-[#66596e] transition-transform group-open:rotate-90"/></div></summary><dl className="mt-4 grid grid-cols-2 gap-4">{columns.filter(c=>c!=='symbol').map(c=><div key={c}><dt className="text-[10px] uppercase tracking-[.1em] text-[#685b70]">{c}</dt><dd className="mt-1 truncate text-sm text-[#cfc3d6]">{String(r?.[c]??'—')}</dd></div>)}</dl></details>)}</div>:<Empty/>}</div></div>}
function Empty(){return <div className="py-10 text-center"><p className="text-sm font-medium text-[#aaa0b1]">No data yet</p><p className="mt-1 text-xs text-[#665a6d]">This section will populate when data is available.</p></div>}
function LoadingCard({label}:{label:string}){return <div className="rounded-[22px] border border-violet-200/[0.08] bg-[#150d1d] p-5"><div className="flex items-center gap-3"><div className="size-5 animate-pulse rounded-full bg-violet-200/10"/><span className="text-sm text-[#82758b]">{label}</span></div></div>}
function buildAllocation(rows:any[]){const palette=['#ffd642','#bd68ee','#b894df','#7137a5','#8b55c7','#d89aff'];const values=rows.map(r=>({symbol:String(r?.symbol??r?.code??'Other'),value:Number(r?.marketValue??r?.currentValue??r?.value??0)})).filter(x=>x.value>0);const total=values.reduce((a,x)=>a+x.value,0);const items=values.map((x,i)=>({...x,percent:total?x.value/total*100:0,color:palette[i%palette.length]}));let cursor=0;const stops=items.length?items.map(x=>{const start=cursor;cursor+=x.percent;return `${x.color} ${start}% ${cursor}%`}).join(', '):'#2a2030 0 100%';return{items,gradient:`conic-gradient(${stops})`}}
function formatMoney(value:any){if(value==null||value==='')return '—';const n=Number(value);if(!Number.isFinite(n))return String(value);return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(n)}
function formatNumber(value:any){const n=Number(value);return Number.isFinite(n)?n.toFixed(2):String(value)}
