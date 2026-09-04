'use client';

import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Bot,
  ChevronRight,
  Cpu,
  Home,
  Plus,
  Settings,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NavigationDock } from '../../components/navigation/NavigationDock';
import { Button } from '../../components/ui/button';
import { useAuthStore } from '../../lib/store';
import { platformApi } from '../../lib/api';
import { useTCEDataStore } from '../../lib/tce-data-store';

type BotRow = { id: string; name: string; environment: string; isActive: boolean };
type Assignment = { id: string; telegram_credential_id: string; service_name: string; min_level: string; enabled: boolean };

const navigation = [
  { id: 'overview', label: 'Overview', icon: Home, href: '/dashboard' },
  { id: 'positions', label: 'Positions', icon: BarChart3, href: '/dashboard?tab=positions' },
  { id: 'orders', label: 'Orders', icon: ArrowLeftRight, href: '/dashboard?tab=orders' },
  { id: 'engine', label: 'Engine', icon: Cpu, href: '/engines' },
  { id: 'notifications', label: 'Notifications', icon: Bell, href: '/notifications' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/dashboard?tab=settings' },
];

export default function NotificationsPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user); const authLoading = useAuthStore(s => s.loading); const initialized = useAuthStore(s => s.initialized); const init = useAuthStore(s => s.init);
  const cachedBots = useTCEDataStore(s => s.telegramBots); const cachedAssignments = useTCEDataStore(s => s.telegramAssignments);
  const [bots, setBots] = useState<BotRow[]>([]); const [assignments, setAssignments] = useState<Assignment[]>([]); const [loading, setLoading] = useState(true);

  useEffect(() => { void init(); }, [init]);
  useEffect(() => {
    if (cachedBots !== null || cachedAssignments !== null) { setBots(Array.isArray(cachedBots) ? (cachedBots as BotRow[]) : []); setAssignments(Array.isArray(cachedAssignments) ? (cachedAssignments as Assignment[]) : []); setLoading(false); return; }
    void load();
  }, [cachedBots, cachedAssignments]);
  async function load() {
    setLoading(true);
    try {
      const [b, a] = await Promise.all([platformApi.telegramBots(), platformApi.telegramDebugAssignments()]);
      const botRows = b.data?.bots ?? b.data ?? []; const assignmentRows = Array.isArray(a.data) ? a.data : (a.data?.assignments ?? []);
      setBots(Array.isArray(botRows) ? botRows : []); setAssignments(Array.isArray(assignmentRows) ? assignmentRows : []);
    } catch { setBots([]); setAssignments([]); } finally { setLoading(false); }
  }

  if (authLoading || !initialized || !user) return <main className="app-shell"><div className="loading-state"><div className="brand-orb"><Bell className="size-4" /></div><div><strong>Opening TCE</strong><span>Checking secure session…</span></div></div></main>;

  return (
    <main className="app-shell">
      <header className="app-header"><div className="app-container app-header-inner"><div className="flex items-center gap-3"><Link href="/dashboard" prefetch className="touch-target grid place-items-center rounded-2xl border border-violet-200/[0.09] bg-white/[0.02] text-[#a88bb5]" aria-label="Back to dashboard"><ArrowLeft className="size-4" /></Link><div><p className="eyebrow">TCE</p><p className="account-email">Notification service</p></div></div></div></header>
      <div className="app-container app-content">
        <section className="page-heading notification-heading">
          <div className="min-w-0"><p className="eyebrow">Delivery</p><h1>Notifications</h1><p className="page-subtitle">Manage notification channels and their delivery routing.</p></div>
          <Button type="button" onClick={() => router.push('/notifications/new')} className="notification-add"><Plus className="size-4" />Add bot</Button>
        </section>
        <section className="notification-section">
          <div className="notification-section-head"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Telegram bots</div><div className="text-xs text-zinc-500">{bots.length} configured</div></div>
          {loading ? <div className="notification-skeleton" /> : bots.length === 0 ? (
            <button type="button" onClick={() => router.push('/notifications/new')} className="notification-empty">
              <div className="notification-empty-icon"><Bot className="size-5" /></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">No Telegram bots configured</div><div className="mt-1 text-xs text-zinc-500">Add a bot to start delivering TCE notifications.</div></div><ChevronRight className="size-4 text-zinc-600" />
            </button>
          ) : (
            <div className="notification-list-scroll">
              {bots.map(bot => {
                const routes = assignments.filter(item => item.telegram_credential_id === bot.id);
                return <button key={bot.id} type="button" onClick={() => router.push(`/notifications/${encodeURIComponent(bot.id)}`)} className="notification-row">
                  <div className="notification-bot-icon"><Bot className="size-5" /></div><div className="min-w-0 flex-1"><div className="notification-title"><span className="truncate text-sm font-semibold text-white">{bot.name}</span><span className={`notification-status ${bot.isActive ? 'is-active' : ''}`}>{bot.isActive ? 'Active' : 'Inactive'}</span></div><div className="notification-meta"><span className="capitalize">{bot.environment}</span><span>·</span><span>{routes.length} debug route{routes.length === 1 ? '' : 's'}</span></div></div><ChevronRight className="size-4 shrink-0 text-zinc-600" />
                </button>;
              })}
            </div>
          )}
        </section>
      </div>
      <NavigationDock items={navigation.map(item => ({ ...item, active: item.id === 'notifications' }))} />
    </main>
  );
}
