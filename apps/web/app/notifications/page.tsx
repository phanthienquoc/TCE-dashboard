'use client';

import { Bell, Bot, ChevronRight, Plus, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { isApiRequestCancelled } from '../../lib/api-errors';
import { useAuthStore } from '../../lib/store';
import {
  hasCompleteTelegramNotificationCache,
  loadTelegramNotificationData,
  normalizeTelegramNotificationReadError,
} from '../../lib/telegram-notification-data';
import { useTCEDataStore } from '../../lib/tce-data-store';
import { enableSystemUpdateNotifications } from '../../lib/system-updates';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const [pushState, setPushState] = useState<'idle' | 'loading' | 'enabled' | 'error'>('idle');

  useEffect(() => {
    void init();
  }, [init]);
  useEffect(() => {
    const userId = user?.id;
    if (!initialized || authLoading || !userId) {
      setBots([]);
      setAssignments([]);
      setLoading(!initialized || authLoading);
      setLoadError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    if (hasCompleteTelegramNotificationCache(cachedBots, cachedAssignments)) {
      setBots(cachedBots as BotRow[]);
      setAssignments(cachedAssignments as Assignment[]);
      setLoading(false);
      setLoadError(null);
      return () => {
        active = false;
        controller.abort();
      };
    }

    setBots([]);
    setAssignments([]);
    setLoading(true);
    setLoadError(null);
    void loadTelegramNotificationData(controller.signal)
      .then(({ bots: botRows, assignments: assignmentRows }) => {
        if (!active || controller.signal.aborted) return;
        setBots(botRows);
        setAssignments(assignmentRows);
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isApiRequestCancelled(error)) return;
        setBots([]);
        setAssignments([]);
        setLoadError(normalizeTelegramNotificationReadError(error));
      })
      .finally(() => {
        if (active && !controller.signal.aborted) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [authLoading, initialized, user?.id, cachedBots, cachedAssignments, reloadAttempt]);

  async function enablePush() {
    setPushState('loading');
    try {
      await enableSystemUpdateNotifications();
      setPushState('enabled');
    } catch (error) {
      console.error('[SYSTEM_UPDATE_PUSH]', error);
      setPushState('error');
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
          <span>System updates</span>
          <span>Release alerts</span>
        </div>
        <div className="notification-empty flex items-center gap-3 p-4">
          <div className="notification-empty-icon">
            <Smartphone className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">PWA update notifications</div>
            <div className="mt-1 text-xs text-muted">
              Get a native notification when a new TCE release is deployed.
            </div>
          </div>
          <Button type="button" onClick={enablePush} disabled={pushState === 'loading'}>
            {pushState === 'loading'
              ? 'Enabling…'
              : pushState === 'enabled'
                ? 'Enabled'
                : pushState === 'error'
                  ? 'Retry'
                  : 'Enable'}
          </Button>
        </div>
      </section>

      <section className="notification-section mt-3">
        <div className="notification-section-head">
          <span>Telegram bots</span>
          <span>
            {loadError
              ? 'Unavailable'
              : loading
                ? 'Loading…'
                : `${bots.length} configured`}
          </span>
        </div>
        {loading ? (
          <div className="loading-state m-3 min-h-20 animate-pulse" />
        ) : loadError ? (
          <div className="notification-empty flex items-center gap-3 p-4" role="alert">
            <div className="notification-empty-icon">
              <Bell className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">
                Unable to load Telegram bots
              </div>
              <div className="mt-1 text-xs text-muted">{loadError}</div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReloadAttempt(attempt => attempt + 1)}
            >
              Retry
            </Button>
          </div>
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
      {!loadError && (
        <Button
          type="button"
          onClick={() => router.push('/notifications/new')}
          className="mt-3 w-full"
        >
          <Plus className="size-4" />
          Add bot
        </Button>
      )}
    </DashboardLayout>
  );
}
