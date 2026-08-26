'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, BarChart3, Cpu, Home, Settings } from 'lucide-react';
import { useEffect } from 'react';
import EngineControlPanel from './EngineControlPanel';
import { useAuthStore } from '../../lib/store';

const navigation = [
  { href: '/dashboard?tab=overview', label: 'Overview', icon: Home },
  { href: '/dashboard?tab=positions', label: 'Positions', icon: BarChart3 },
  { href: '/dashboard?tab=orders', label: 'Orders', icon: ArrowLeftRight },
  { href: '/engines', label: 'Engine', icon: Cpu },
  { href: '/dashboard?tab=settings', label: 'Settings', icon: Settings },
];

export default function EnginesPage() {
  const { user, loading: authLoading, initialized, init } = useAuthStore();

  useEffect(() => { void init(); }, [init]);

  if (authLoading || !initialized || !user) {
    return <main className="app-shell"><div className="loading-state"><div className="brand-orb"><Cpu className="size-4" /></div><div><strong>Opening TCE</strong><span>Checking secure session…</span></div></div></main>;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-container app-header-inner">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="touch-target grid place-items-center rounded-2xl border border-violet-200/[0.09] bg-white/[0.02] text-[#a88bb5]" aria-label="Back to dashboard"><ArrowLeft className="size-4" /></Link>
            <div><p className="eyebrow">TCE</p><p className="account-email">Engine runtime</p></div>
          </div>
        </div>
      </header>
      <div className="app-container app-content engine-page-content">
        <EngineControlPanel />
      </div>
      <nav aria-label="Dashboard navigation" className="mobile-bottom-nav">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = label === 'Engine';
          return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`bottom-nav-item ${active ? 'is-active' : ''}`}>
            <span className="bottom-nav-icon"><Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.9} /></span>
            <span>{label}</span>
          </Link>;
        })}
      </nav>
    </main>
  );
}
