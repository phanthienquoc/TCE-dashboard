'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Bell, Home, Settings, ArrowLeftRight } from 'lucide-react';
import { useEffect } from 'react';
import { NavigationDock } from '../../../components/navigation/NavigationDock';
import { useAuthStore } from '../../../lib/store';

const BinanceXauTradingPanel = dynamic(() => import('../BinanceXauTradingPanel'), {
  loading: () => <div className="loading-state min-h-[220px] animate-pulse rounded-2xl p-4" />,
});
const navigation = [
  { id: 'overview', label: 'Overview', icon: Home, href: '/dashboard' },
  { id: 'positions', label: 'Positions', icon: BarChart3, href: '/dashboard?tab=positions' },
  { id: 'orders', label: 'Orders', icon: ArrowLeftRight, href: '/dashboard?tab=orders' },
  { id: 'engine', label: 'Engine', icon: BarChart3, href: '/engines' },
  { id: 'notifications', label: 'Notifications', icon: Bell, href: '/notifications' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/dashboard?tab=settings' },
];
export default function BinanceXauPage() {
  const user=useAuthStore(s=>s.user); const authLoading=useAuthStore(s=>s.loading); const initialized=useAuthStore(s=>s.initialized); const init=useAuthStore(s=>s.init);
  useEffect(()=>{void init();},[init]);
  if(authLoading||!initialized||!user) return <main className="app-shell"><div className="app-container app-content"><div className="loading-state p-4">Loading…</div></div></main>;
  return <main className="app-shell"><div className="app-container app-content engine-page-content"><div className="mb-3 flex items-center gap-2"><Link href="/engines" className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-surface text-foreground" aria-label="Back to engines"><ArrowLeft className="size-4" /></Link><div><p className="eyebrow">Binance Futures</p><p className="account-email">XAU Trading</p></div></div><section className="page-heading"><div><p className="eyebrow">Execution</p><h1>XAU Futures</h1><p className="page-subtitle">Telegram signal gateway, single-position guard and live protection.</p></div></section><BinanceXauTradingPanel /></div><NavigationDock items={navigation.map(item=>({...item,active:item.id==='engine'}))}/></main>;
}
