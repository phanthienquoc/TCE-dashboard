'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '../../../components/dashboard/DashboardLayout';
import { DetailSkeleton } from '../../../components/ui/page-skeleton';
import { Button } from '../../../components/ui/button';
import { useAuthStore } from '../../../lib/store';
import { platformApi } from '../../../lib/api';

const TelegramBotConfig = dynamic(() => import('../TelegramBotConfig'), {
  loading: () => <DetailSkeleton />,
});

type BotRow = { id: string; name: string; environment: string; isActive: boolean };

export default function NotificationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
        setBot(
          Array.isArray(rows) ? (rows.find((item: BotRow) => item.id === params.id) ?? null) : null
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [initialized, user, params?.id]);

  if (authLoading || !initialized) return <DetailSkeleton />;
  if (!user) return null;

  return (
    <DashboardLayout activeId="notifications">
      {loading ? (
        <DetailSkeleton />
      ) : !bot ? (
        <section className="empty-state p-5">
          <p className="eyebrow">Notification channel</p>
          <h1 className="mt-2 text-xl font-semibold">Bot not found</h1>
          <p className="page-subtitle">This Telegram channel may have been removed or is no longer available.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => router.push('/notifications')}>
            Back to notifications
          </Button>
        </section>
      ) : (
        <div className="notification-page-content"><TelegramBotConfig /></div>
      )}
    </DashboardLayout>
  );
}
