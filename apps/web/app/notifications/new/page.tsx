'use client';

import dynamic from 'next/dynamic';
import { ArrowLeft, Bell } from 'lucide-react';
import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { NavigationDock } from '../../../components/navigation/NavigationDock';

const TelegramBotConfig = dynamic(() => import('../TelegramBotConfig'), {
  loading: () => (
    <div className="min-h-[360px] animate-pulse rounded-2xl border border-violet-200/[0.07] bg-white/[0.02]" />
  ),
});

export default function NewNotificationPage() {
  const router = useRouter();

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
            <div className="min-w-0">
              <p className="eyebrow">Notifications</p>
              <p className="account-email">New Telegram channel</p>
            </div>
          </div>
        </div>
      </header>
      <div className="app-container app-content">
        <section className="page-heading">
          <div className="min-w-0">
            <p className="eyebrow">Delivery</p>
            <h1>Add notification channel</h1>
            <p className="page-subtitle">
              Connect a Telegram bot and configure its backend debug routing.
            </p>
          </div>
          <div className="hero-status">Telegram</div>
        </section>
        <TelegramBotConfig />
      </div>
      <Suspense fallback={null}>
        <NavigationDock
          items={[{ id: 'notifications', label: 'Notifications', icon: Bell, active: true }]}
          onSelect={() => router.push('/notifications')}
        />
      </Suspense>
    </main>
  );
}
