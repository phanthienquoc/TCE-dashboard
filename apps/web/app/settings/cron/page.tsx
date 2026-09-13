'use client';

import Link from 'next/link';
import DashboardShell from '../../../components/dashboard/DashboardShell';

export default function CronIndexPage() {
  return (
    <DashboardShell view="settings">
      {() => (
        <main className="tce-settings-card">
          <span className="tce-label">CRON JOBS</span>
          <h1>Automation schedules</h1>
          <p className="text-sm text-muted">Manage background TCE jobs.</p>
          <Link href="/settings/cron/auto-profit-exit">Automatic Profit Exit</Link>
        </main>
      )}
    </DashboardShell>
  );
}
