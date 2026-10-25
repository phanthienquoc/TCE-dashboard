'use client';

import dynamic from 'next/dynamic';
import DashboardLayout from '../../../components/dashboard/DashboardLayout';

const TelegramBotConfig = dynamic(() => import('../TelegramBotConfig'), {
  loading: () => <div className="loading-state min-h-[360px] animate-pulse rounded-2xl p-4" />,
});

export default function NewNotificationPage() {
  return (
    <DashboardLayout activeId="notifications">
      <div className="notification-page-content">
        <TelegramBotConfig />
      </div>
    </DashboardLayout>
  );
}
