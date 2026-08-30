'use client';

import { ArrowLeft, ArrowLeftRight, BarChart3, Bell, Cpu, Home, Settings } from 'lucide-react';
import { useEffect } from 'react';
import TelegramBotConfig from './TelegramBotConfig';
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

export default function NotificationsPage() {
  const { user, loading: authLoading, initialized, init } = useAuthStore();
  useEffect(() => { void init(); }, [init]);
  if (authLoading || !initialized || !user) return <main className="app-shell"><div className="loading-state"><div className="brand-orb"><Bell className="size-4" /></div><div><strong>Opening TCE</strong><span>Checking secure session…</span></div></div></main>;
  const select = (id: string) => {
    if (id === 'notifications') return;
    if (id === 'engine') return window.location.assign('/engines');
    if (id === 'settings') return window.location.assign('/dashboard?tab=settings');
    if (id === 'overview') return window.location.assign('/dashboard');
    return window.location.assign(`/dashboard?tab=${id}`);
  };
  return <main className="app-shell"><header className="app-header"><div className="app-container app-header-inner"><div className="flex items-center gap-3"><div className="touch-target grid place-items-center rounded-2xl border border-violet-200/[0.09] bg-white/[0.02] text-[#a88bb5]"><Bell className="size-4" /></div><div><p className="eyebrow">TCE</p><p className="account-email">Notification service</p></div></div></div></header><div className="app-container app-content"><section className="page-heading"><div><p className="eyebrow">Delivery</p><h1>Notifications</h1><p className="page-subtitle">Configure notification channels independently from engine runtime settings.</p></div><div className="hero-status">Telegram</div></section><TelegramBotConfig /></div><NavigationDock items={navigation.map(item => ({ ...item, active: item.id === 'notifications' }))} onSelect={select} /></main>;
}
