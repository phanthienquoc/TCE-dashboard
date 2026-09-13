'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bell, ChevronRight, Cpu, KeyRound, SlidersHorizontal } from 'lucide-react';

function Row({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[72px] items-center gap-4 border-b border-white/10 px-4 last:border-b-0 active:bg-white/5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sky-300">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-[16px] font-medium text-white">{title}</strong>
        <span className="block truncate text-sm text-slate-400">{subtitle}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-slate-500" />
    </Link>
  );
}

export default function SettingsHome() {
  return (
    <div className="tce-mobile-view space-y-6">
      <header className="px-1 pt-2">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="size-6 text-slate-300" />
          <div>
            <h1 className="text-2xl font-semibold text-white">Settings</h1>
            <p className="text-sm text-slate-400">TCE system configuration</p>
          </div>
        </div>
      </header>
      <section>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Automation
        </p>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
          <Row
            href="/settings/cron"
            icon={<span className="text-xl">◷</span>}
            title="Cron Jobs"
            subtitle="Scheduled TCE automations"
          />
          <Row
            href="/settings/engine"
            icon={<Cpu className="size-5" />}
            title="Engines"
            subtitle="Decision, execution & market engines"
          />
        </div>
      </section>
      <section>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          System
        </p>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
          <Row
            href="/settings/platform"
            icon={<KeyRound className="size-5" />}
            title="Connections & environments"
            subtitle="SSI, Binance and AI providers"
          />
          <Row
            href="/settings/notifications"
            icon={<Bell className="size-5" />}
            title="Notifications"
            subtitle="Push notification preferences"
          />
        </div>
      </section>
    </div>
  );
}
