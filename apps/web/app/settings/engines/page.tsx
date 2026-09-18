'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Cpu } from 'lucide-react';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import { ENGINE_REGISTRY } from '../../engines/engine-registry';
import { useEngineRuntimeStore } from '../../../lib/engine-runtime-store';

const LAYERS = [
  {
    id: 'market-data',
    label: 'Market Data',
    description: 'Thu thập và xử lý dữ liệu thị trường',
    accent: 'text-amber-300',
    badge: 'bg-amber-400/10 text-amber-300',
  },
  {
    id: 'decision',
    label: 'Decision',
    description: 'Phân tích · Tín hiệu · Chiến lược',
    accent: 'text-sky-300',
    badge: 'bg-sky-400/10 text-sky-300',
  },
  {
    id: 'execution',
    label: 'Execution',
    description: 'Thực thi lệnh · Kết nối sàn · Quản lý vị thế',
    accent: 'text-emerald-300',
    badge: 'bg-emerald-400/10 text-emerald-300',
  },
  {
    id: 'derivatives',
    label: 'Derivatives',
    description: 'Phái sinh · Futures',
    accent: 'text-violet-300',
    badge: 'bg-violet-400/10 text-violet-300',
  },
  {
    id: 'utility',
    label: 'Utility',
    description: 'Hệ thống · Giám sát · Công cụ hỗ trợ',
    accent: 'text-slate-300',
    badge: 'bg-white/10 text-slate-300',
  },
] as const;

export default function SettingsEnginesPage() {
  const { engines, refresh } = useEngineRuntimeStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleIds = new Set(engines.map(engine => engine.engineId));

  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view space-y-5 pb-8">
          <header className="px-1 pt-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Settings
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Engines</h1>
            <p className="mt-1 text-sm text-slate-400">
              Engine được nhóm tự động theo layer từ Runtime DB
            </p>
          </header>

          <div className="space-y-3">
            {LAYERS.map((layer, index) => {
              const engines = ENGINE_REGISTRY.filter(
                engine => engine.layer === layer.id && visibleIds.has(engine.id)
              );

              return (
                <section
                  key={layer.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"
                >
                  <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
                    <span
                      className={'flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ' + layer.badge}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className={'text-[15px] font-semibold ' + layer.accent}>
                        {layer.label} Layer
                      </h2>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {layer.description}
                      </p>
                    </div>
                    <span className="text-slate-500">
                      <ChevronDown className="size-4" />
                    </span>
                  </div>

                  <div className="grid gap-2 p-3 sm:grid-cols-2">
                    {engines.length ? (
                      engines.map(engine => (
                        <Link
                          key={engine.id}
                          href={'/settings/engines/' + engine.id}
                          className="group flex min-h-[68px] items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-3.5 transition-colors active:bg-white/5"
                        >
                          <span
                            className={'flex size-10 shrink-0 items-center justify-center rounded-xl ' + layer.badge}
                          >
                            <Cpu className={'size-5 ' + layer.accent} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm font-medium text-white">
                              {engine.name}
                            </strong>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-slate-600 transition-colors group-hover:text-slate-300" />
                        </Link>
                      ))
                    ) : (
                      <div className="col-span-full px-2 py-4 text-center text-xs text-slate-500">
                        Chưa có engine trong tầng này
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
