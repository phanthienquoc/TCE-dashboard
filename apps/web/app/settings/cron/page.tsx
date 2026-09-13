'use client';

import Link from 'next/link';
import DashboardShell from '../../../components/dashboard/DashboardShell';

export default function CronIndexPage() {
  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view">
          <section className="tce-settings-group">
            <div className="tce-settings-group-title">CRON JOBS</div>
            <Link className="tce-setting-row" href="/settings/cron/auto-profit-exit">
              <span className="tce-setting-icon">◷</span>
              <div>
                <strong>Auto Profit Exit</strong>
                <span>SELL profitable stock positions</span>
              </div>
              <span className="tce-setting-chevron">›</span>
            </Link>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
