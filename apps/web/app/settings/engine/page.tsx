'use client';

import Link from 'next/link';
import { ChevronRight, Cpu } from 'lucide-react';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import { ENGINE_REGISTRY } from '../../engines/engine-registry';

export default function SettingsEnginesPage() {
  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view space-y-6">
          <header className="px-1 pt-2">
            <p className="text-sm text-slate-400">Settings</p>
            <h1 className="text-2xl font-semibold text-white">Engines</h1>
          </header>
          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Engine Runtime</p>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              {ENGINE_REGISTRY.map(engine => (
                <Link key={engine.id} href={`/settings/engine/${engine.id}`} className="flex min-h-[76px] items-center gap-4 border-b border-white/10 px-4 last:border-b-0 active:bg-white/5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sky-300"><Cpu className="size-5" /></span>
                  <span className="min-w-0 flex-1"><strong className="block text-[16px] font-medium text-white">{engine.name}</strong><span className="block truncate text-sm text-slate-400">{engine.category} · {engine.platform}</span></span>
                  <ChevronRight className="size-5 shrink-0 text-slate-500" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
