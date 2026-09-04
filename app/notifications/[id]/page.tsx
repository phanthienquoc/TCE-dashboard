'use client';

import dynamic from 'next/dynamic';
import { ArrowLeft, Bell, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { NavigationDock } from '../../../components/navigation/NavigationDock';
import { useAuthStore } from '../../../lib/store';
import { platformApi } from '../../../lib/api';

const TelegramBotConfig = dynamic(() => import('../TelegramBotConfig'), {
  loading: () => (
    <div className="min-h-[360px] animate-pulse rounded-2xl border border-violet-200/[0.07] bg-white/[0.02]" />
  ),
});

type BotRow = { id: string; name: string; environment: string; isActive: boolean };

export default function NotificationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const user = useAuthStore(s => s.user);
  const authLoading = useAuthStore(s => s.loading);
  const initialized = useAuthStore(s => s.initialized);
  const init = useAuthStore(s => s.init);
  const [bot, setBot] = useState<BotRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!initialized || !user || !params?.id) return;
    void (async () => {
      try {
        const response = await platformApi.telegramBots();
        const rows = response.data?.bots ?? response.data ?? [];
        const found = Array.isArray(rows)
          ? rows.find((item: BotRow) => item.id === params.id)
          : null;
        setBot(found ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [initialized, user, params?.id]);

  if (authLoading || !initialized || !user) {
    return (
      <main className="app-shell">
        <div className="loading-state">
          <div className="brand-orb">
            <Bell className="size-4" />
          </div>
          <div>
            <strong>Opening TCE</strong>
            <span>Checking secure session…</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-container app-header-inner">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/notifications')}
              className="touch-target grid place-items-center rounded-2xl border border-violet-200/[0.09] bg-white/[0.02] text-[#a88bb5]"
              aria-label="Back to notifications"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <p className="eyebrow">Notifications</p>
              <p className="account-email">{bot?.name ?? 'Notification channel'}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="app-container app-content">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center text-zinc-500">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading channel…
          </div>
        ) : !bot ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="eyebrow">Notification channel</p>
            <h1 className="mt-2">Bot not found</h1>
            <p className="page-subtitle">
              This Telegram channel may have been removed or is no longer available.
            </p>
            <button
              type="button"
              onClick={() => router.push('/notifications')}
              className="mt-5 text-sm font-medium text-violet-200 hover:text-white"
            >
              Back to notifications
            </button>
          </section>
        ) : (
          <>
            <section className="page-heading">
              <div>
                <p className="eyebrow">Telegram channel</p>
                <h1>{bot.name}</h1>
                <p className="page-subtitle">
                  {bot.environment} · {bot.isActive ? 'Active' : 'Inactive'} · credentials and
                  delivery routing
                </p>
              </div>
              <div className={`hero-status ${bot.isActive ? '' : 'opacity-50'}`}>
                {bot.isActive ? 'Active' : 'Inactive'}
              </div>
            </section>
            <TelegramBotConfig />
          </>
        )}
      </div>

      <NavigationDock
        items={[{ id: 'notifications', label: 'Notifications', icon: Bell, active: true }]}
        onSelect={() => router.push('/notifications')}
      />
    </main>
  );
}
