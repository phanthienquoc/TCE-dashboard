'use client';

import { ChevronRight, Clock3, Cpu, Layers3 } from 'lucide-react';
import Link from 'next/link';
import { ENGINE_REGISTRY } from '../../app/engines/engine-registry';

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 px-4 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <div className="overflow-hidden rounded-2xl border border-violet-200/[0.08] bg-white/[0.035]">
        {children}
      </div>
    </section>
  );
}

function SettingsLink({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 border-b border-violet-200/[0.07] px-4 py-3 last:border-b-0 transition hover:bg-white/[0.04] active:bg-white/[0.06]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-white/80">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm text-white">{title}</strong>
        <span className="mt-0.5 block truncate text-xs text-muted">{detail}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted" />
    </Link>
  );
}

export default function SettingsHome() {
  return (
    <div className="tce-mobile-view">
      <div className="py-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-muted">TCE system configuration</p>
      </div>

      <SettingsGroup title="Automation">
        <SettingsLink
          href="/settings/cron/auto-profit-exit"
          icon={<Clock3 className="size-5" />}
          title="Cron Jobs"
          detail="Schedules and background automation"
        />
      </SettingsGroup>

      <SettingsGroup title="Engines">
        {ENGINE_REGISTRY.map(engine => (
          <SettingsLink
            key={engine.id}
            href={`/settings/engine/${engine.id}`}
            icon={<Cpu className="size-5" />}
            title={engine.name}
            detail={`${engine.platform} · ${engine.category}`}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup title="System">
        <SettingsLink
          href="/settings/engine/tce-decision"
          icon={<Layers3 className="size-5" />}
          title="TCE Decision Engine"
          detail="Decision, risk and take-profit configuration"
        />
      </SettingsGroup>
    </div>
  );
}
