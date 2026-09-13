'use client';

import Link from 'next/link';

export default function CronManagementCard() {
  return (
    <section className="tce-settings-card">
      <div className="tce-section-row">
        <div>
          <span className="tce-label">CRON JOBS</span>
          <strong>Automation</strong>
          <p className="mt-1 text-sm text-muted">Manage background TCE jobs and schedules.</p>
        </div>
        <Link href="/settings/cron/auto-profit-exit" aria-label="Open cron jobs">
          <span aria-hidden="true">›</span>
        </Link>
      </div>
    </section>
  );
}
