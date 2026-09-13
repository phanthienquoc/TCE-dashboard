'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import DashboardShell from '../../../../components/dashboard/DashboardShell';

export default function CronIndexPage() {
  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view space-y-6">
          <header className="px-1 pt-2">
            <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-sky-300"><ChevronLeft className="size-4" /> Settings</Link>
            <h1 className="text-2xl font-semibold text-white">Cron Jobs</h1>
            <p className="mt-1 text-sm text-slate-400">Scheduled TCE automations</p>
          </header>
          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Automation</p>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              <Link href="/settings/cron/auto-profit-exit" className="flex min-h-[76px] items-center gap-4 border-b border-white/10 px-4 active:bg-white/5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-sky-300"><Clock3 className="size-5" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-[16px] font-medium text-white">Auto Profit Exit</strong><span className="block truncate text-sm text-slate-400">SELL profitable stock positions</span></span>
                <ChevronRight className="size-5 text-slate-500" />
              </Link>
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
