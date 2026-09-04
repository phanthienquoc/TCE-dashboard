'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Bell, Cpu, Home, Settings, ArrowLeftRight } from 'lucide-react';
import { useEffect } from 'react';
import { NavigationDock } from '../../components/navigation/NavigationDock';
import { useAuthStore } from '../../lib/store';

const EngineControlPanel = dynamic(() => import('./EngineControlPanel'), {
  loading: () => <div className="loading-state min-h-[180px] animate-pulse rounded-2xl p-4" />,
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
  useEffect(() => {
    void init();
  }, [init]);

  if (authLoading || !initialized || !user) {
    return (
      <main className="app-shell">
        <div className="app-container app-content">
          <div className="loading-state flex items-center gap-3 p-4">
            <div className="brand-orb">
              <Cpu className="size-4" />
            </div>
            <div className="min-w-0">
              <strong className="block">Opening TCE</strong>
              <span className="text-sm text-muted">Checking secure session…</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="app-container app-content engine-page-content">
        <div className="mb-3 flex items-center gap-2">
          <Link
            href="/dashboard"
            prefetch
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-surface text-foreground"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <p className="eyebrow">TCE</p>
            <p className="account-email">Engine runtime</p>
          </div>
        </div>
        <EngineControlPanel />
      </div>
      <NavigationDock items={navigation.map(item => ({ ...item, active: item.id === 'engine' }))} />
    </main>
  );
}
