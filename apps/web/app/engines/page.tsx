'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Bell, Cpu, Home, Settings, ArrowLeftRight } from 'lucide-react';
import { useEffect } from 'react';
import { NavigationDock } from '../../components/navigation/NavigationDock';
import { useAuthStore } from '../../lib/store';

const EngineControlPanel = dynamic(() => import('./EngineControlPanel'), {
  loading: () => <div className="min-h-[180px] animate-pulse rounded-2xl border border-violet-200/[0.07] bg-white/[0.02]" />,
});

const navigation = [
  { id: 'overview', label: 'Overview', icon: Home, href: '/dashboard' },
  { id: 'positions', label: 'Positions', icon: BarChart3, href: '/dashboard?tab=positions' },
  { id: 'orders', label: 'Orders', icon: ArrowLeftRight, href: '/dashboard?tab=orders' },
  { id: 'engine', label: 'Engine', icon: Cpu, href: '/engines' },
  { id: 'notifications', label: 'Notifications', icon: Bell, href: '/notifications' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/dashboard?tab=settings' },
];

export default function EnginesPage() {
  const user = useAuthStore(s => s.user);
  const authLoading = useAuthStore(s => s.loading);
  const initialized = useAuthStore(s => s.initialized);
  const init = useAuthStore(s => s.init);
  useEffect(() => { void init(); }, [init]);

  if (authLoading || !initialized || !user) {
    return <main className="app-shell"><div className="loading-state"><div className="brand-orb"><Cpu className="size-4" /></div><div><strong>Opening TCE</strong><span>Checking secure session…</span></div></div></main>;
  }

  return (
    <main className="app-shell">
      <header className="app-header"><div className="app-container app-header-inner"><div className="flex items-center gap-3"><Link href="/dashboard" prefetch className="touch-target grid place-items-center rounded-2xl border border-violet-200/[0.09] bg-white/[0.02] text-[#a88bb5]" aria-label="Back to dashboard"><ArrowLeft className="size-4" /></Link><div><p className="eyebrow">TCE</p><p className="account-email">Engine runtime</p></div></div></div></header>
      <div className="app-container app-content engine-page-content"><EngineControlPanel /></div>
      <NavigationDock items={navigation.map(item => ({ ...item, active: item.id === 'engine' }))} />
    </main>
  );
}
