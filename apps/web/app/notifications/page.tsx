'use client';

import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowLeftRight, BarChart3, Bell, Cpu, Home, Settings } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavigationDock } from '../../components/navigation/NavigationDock';
import { useAuthStore } from '../../lib/store';

const TelegramBotConfig = dynamic(() => import('./TelegramBotConfig'), {
  loading: () => <div className="min-h-[360px] animate-pulse rounded-2xl border border-violet-200/[0.07] bg-white/[0.02]" />,
});

const navigation = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'positions', label: 'Positions', icon: BarChart3 },
  { id: 'orders', label: 'Orders', icon: ArrowLeftRight },
  { id: 'engine', label: 'Engine', icon: Cpu },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function NotificationsPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const authLoading = useAuthStore(s => s.loading);
  const initialized = useAuthStore(s => s.initialized);
  const init = useAuthStore(s => s.init);
  useEffect(() => { void init(); }, [init]);
  if (authLoading || !initialized || !user)
    return <main className="app-shell"><div className="loading-state"><div className="brand-orb"><Bell className="size-4" /></div><div><strong>Opening TCE</strong><span>Checking secure session…</span></div></div></main>;
  const select = (id: string) => {
    if (id === 'notifications') return;
    if (id === 'engine') return router.push('/engines');
    if (id === 'settings') return router.push('/dashboard?tab=settings');
    if (id === 'overview') return router.push('/dashboard');
    return router.push(`/dashboard?tab=${id}`);
  };
  return (
    <main className="app-shell">
      <header className="app-header"><div className="app-container app-header-inner"><div className="flex items-center gap-3"><button type="button" onClick={() => router.push('/dashboard')} className="touch-target grid place-items-center rounded-2xl border border-violet-200/[0.09] bg-white/[0.02] text-[#a88bb5]" aria-label="Back to dashboard"><ArrowLeft className="size-4" /></button><div><p className="eyebrow">TCE</p><p className="account-email">Notification service</p></div></div></div></header>
      <div className="app-container app-content"><section className="page-heading"><div><p className="eyebrow">Delivery</p><h1>Notifications</h1><p className="page-subtitle">Configure notification channels independently from engine runtime settings.</p></div><div className="hero-status">Telegram</div></section><TelegramBotConfig /></div>
      <NavigationDock items={navigation.map(item => ({ ...item, active: item.id === 'notifications' }))} onSelect={select} />
    </main>
  );
}
