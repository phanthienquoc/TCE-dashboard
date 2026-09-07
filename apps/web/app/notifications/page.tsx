'use client';

import { Bell, Bot, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { useAuthStore } from '../../lib/store';
import { platformApi } from '../../lib/api';
import { useTCEDataStore } from '../../lib/tce-data-store';
import DashboardLayout from '../../components/dashboard/DashboardLayout';

type BotRow = { id: string; name: string; environment: string; isActive: boolean };
type Assignment = {
  id: string;
  telegram_credential_id: string;
  service_name: string;
  min_level: string;
  enabled: boolean;
};

export default function NotificationsPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const authLoading = useAuthStore(s => s.loading);
  const initialized = useAuthStore(s => s.initialized);
  const init = useAuthStore(s => s.init);
  const cachedBots = useTCEDataStore(s => s.telegramBots);
  const cachedAssignments = useTCEDataStore(s => s.telegramAssignments);
  const [bots, setBots] = useState<BotRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void init();
  }, [init]);
  useEffect(() => {
    if (cachedBots !== null || cachedAssignments !== null) {
      setBots(Array.isArray(cachedBots) ? (cachedBots as BotRow[]) : []);
      setAssignments(Array.isArray(cachedAssignments) ? (cachedAssignments as Assignment[]) : []);
      setLoading(false);
      return;
    }
    void load();
  }, [cachedBots, cachedAssignments]);
  async function load() {
    setLoading(true);
    try {
      const [b, a] = await Promise.all([
        platformApi.telegramBots(),
        platformApi.telegramDebugAssignments(),
      ]);
      const botRows = b.data?.bots ?? b.data ?? [];
      const assignmentRows = Array.isArray(a.data) ? a.data : (a.data?.assignments ?? []);
      setBots(Array.isArray(botRows) ? botRows : []);
      setAssignments(Array.isArray(assignmentRows) ? assignmentRows : []);
    } catch {
      setBots([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !initialized || !user)
    return (
      <main className="app-shell">
        <div className="app-container app-content">
          <div className="loading-state flex items-center gap-3 p-4">
            <div className="brand-orb">
              <Bell className="size-4" />
            </div>
            <div>
              <strong className="block">Opening TCE</strong>
              <span className="text-sm text-muted">Checking secure session…</span>
            </div>
          </div>
        </div>
      </main>
    );

  return (
    <DashboardLayout activeId="notifications">
      <section className="notification-section">
        <div className="notification-section-head">
          <span>Telegram bots</span>
          <span>{bots.length} configured</span>
        </div>
        {loading ? (
          <div className="loading-state m-3 min-h-20 animate-pulse" />
        ) : bots.length === 0 ? (
          <button
            type="button"
            onClick={() => router.push('/notifications/new')}
            className="notification-empty p-4"
          >
            <div className="notification-empty-icon">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">
                No Telegram bots configured
              </div>
              <div className="mt-1 text-xs text-muted">
                Add a bot to start delivering TCE notifications.
              </div>
            </div>
            <ChevronRight className="size-4 text-muted" />
          </button>
        ) : (
          <div className="notification-list-scroll">
            {bots.map(bot => {
              const routes = assignments.filter(item => item.telegram_credential_id === bot.id);
              return (
                <button
                  key={bot.id}
                  type="button"
                  onClick={() => router.push(`/notifications/${encodeURIComponent(bot.id)}`)}
                  className="notification-row"
                >
                  <div className="notification-bot-icon">
                    <Bot className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="notification-title">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {bot.name}
                      </span>
                      <span className={`notification-status ${bot.isActive ? 'is-active' : ''}`}>
                        {bot.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="notification-meta">
                      <span className="capitalize">{bot.environment}</span>
                      <span>·</span>
                      <span>
                        {routes.length} debug route{routes.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </button>
              );
            })}
          </div>
        )}
      </section>
      <Button
        type="button"
        onClick={() => router.push('/notifications/new')}
        className="mt-3 w-full"
      >
        <Plus className="size-4" />
        Add bot
      </Button>
    </DashboardLayout>
  );
}
