'use client';

import Link from 'next/link';
import { ArrowLeft, BarChart3, Bell, Cpu, Home, Settings, ArrowLeftRight } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EngineControlPanel from './EngineControlPanel';
import { NavigationDock } from '../../components/navigation/NavigationDock';
import { useAuthStore } from '../../lib/store';

const navigation = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'positions', label: 'Positions', icon: BarChart3 },
  { id: 'orders', label: 'Orders', icon: ArrowLeftRight },
  { id: 'engine', label: 'Engine', icon: Cpu },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function EnginesPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const authLoading = useAuthStore(s => s.loading);
  const initialized = useAuthStore(s => s.initialized);
  const init = useAuthStore(s => s.init);
  useEffect(() => { void init(); }, [init]);
  useEffect(() => {
    router.prefetch('/dashboard');
    router.prefetch('/notifications');
    router.prefetch('/dashboard?tab=settings');
  }, [router]);
  if (authLoading || !initialized || !user)
    return <main className="app-shell"><div className="loading-state"><div className="brand-orb"><Cpu className="size-4" /></div><div><strong>Opening TCE</strong><span>Checking secure session…</span></div></div></main>;
  const select = (id: string) => {
    if (id === 'engine') return;
    if (id === 'notifications') return router.push('/notifications');
    if (id === 'settings') return router.push('/dashboard?tab=settings');
    if (id === 'overview') return router.push('/dashboard');
    return router.push(`/dashboard?tab=${id}`);
  };
  return (
    <main className="app-shell">
      <header className="app-header"><div className="app-container app-header-inner"><div className="flex items-center gap-3"><Link href="/dashboard" prefetch className="touch-target grid place-items-center rounded-2xl border border-violet-200/[0.09] bg-white/[0.02] text-[#a88bb5]" aria-label="Back to dashboard"><ArrowLeft className="size-4" /></Link><div><p className="eyebrow">TCE</p><p className="account-email">Engine runtime</p></div></div></div></header>
      <div className="app-container app-content engine-page-content"><section className="page-heading"><div><p className="eyebrow">Runtime</p><h1>Engine</h1><p className="page-subtitle">Control and inspect TCE trading engines.</p></div></section><EngineControlPanel /></div>
      <NavigationDock items={navigation.map(item => ({ ...item, active: item.id === 'engine' }))} onSelect={select} />
    </main>
  );
}
