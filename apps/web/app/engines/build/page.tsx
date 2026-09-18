'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, Clock3, GitPullRequest, ShieldCheck, Workflow } from 'lucide-react';
import DashboardShell from '../../../components/dashboard/DashboardShell';

type BuildStatus = 'done' | 'in-progress' | 'todo';

type BuildStep = {
  id: string;
  phase: string;
  title: string;
  description: string;
  status: BuildStatus;
  deliverables: string[];
  verification: string;
};

const BUILD_STEPS: BuildStep[] = [
  {
    id: 'contracts',
    phase: '01',
    title: 'Engine contract & registry',
    description: 'Register CRDE as a first-class Decision layer engine and define provider-neutral inputs/outputs.',
    status: 'done',
    deliverables: ['CRDE engine ID', 'Decision contract', 'Runtime registry metadata'],
    verification: 'Phase foundation fixes merged in #747; runtime/registry wiring verified'
  },
  {
    id: 'market-pool',
    phase: '02',
    title: 'Market → Pool 20',
    description: 'Build the candidate pipeline around verified dividend events, liquidity, recovery potential and turnover.',
    status: 'done',
    deliverables: ['Pool 20 scoring', 'Deduplication', 'Freshness gates', 'Capital-turnover score'],
    verification: 'PR #741 merged squash; deterministic Pool 20 scorer + gates verified'
  },
  {
    id: 'decision',
    phase: '03',
    title: 'Capital Rotation Decision',
    description: 'Decide BUY / HOLD / SELL / ROTATE / WAIT / SKIP using expected net return per capital-day.',
    status: 'done',
    deliverables: ['CRDE core', 'Entry gates', 'Exit gates', 'Rotation rules'],
    verification: 'PR #743 merged squash; entitlement/TP/invalidation gates verified'
  },
  {
    id: 'allocation',
    phase: '04',
    title: 'Capital & slot lifecycle',
    description: 'Connect CRDE decisions to A/B/C capital pools, slot reservation and recycling without over-allocation.',
    status: 'done',
    deliverables: ['Allocator integration', 'Slot reservation', 'Recycle on close', 'Idempotency'],
    verification: 'PR #745 + #747 merged; realized-P&L recycling regression covered'
  },
  {
    id: 'execution',
    phase: '05',
    title: 'SSI execution bridge',
    description: 'Turn approved decisions into guarded SSI order intents using the existing SDK adapter.',
    status: 'done',
    deliverables: ['Order planner', 'Risk gate', 'SSI adapter', 'Order reconciliation'],
    verification: 'PR #749 squash-merged; PAPER E2E + Risk/Safety Gate boundary verified',
  },
  {
    id: 'lifecycle',
    phase: '06',
    title: 'T+2 & dividend lifecycle',
    description: 'Reconcile filled positions through ex-date, T+2, dividend confirmation and capital release.',
    status: 'done',
    deliverables: ['Position lifecycle', 'Entitlement confirmation', 'Cashflow evidence', 'Exit readiness'],
    verification: 'Phase lifecycle baseline is present on the unified branch; final CI verification pending',
  },
  {
    id: 'cron',
    phase: '07',
    title: 'Runtime cron & observability',
    description: 'Run the engine continuously during VN market hours and persist every run/decision for audit.',
    status: 'done',
    deliverables: ['CRDE cron', 'Run lock/idempotency', 'Decision snapshots', 'Failure recovery'],
    verification: 'Phase runtime baseline is present on the unified branch; final CI verification pending',
  },
  {
    id: 'demo',
    phase: '08',
    title: 'Demo readiness gate',
    description: 'Validate the complete path with cash disabled first, then enable the smallest controlled demo allocation.',
    status: 'in-progress',
    deliverables: ['E2E smoke test', 'Kill switch', 'Paper → assisted checklist', 'Demo sign-off'],
    verification: 'All gates green; no live order before approval',
  },
];

const statusMeta: Record<BuildStatus, { label: string; className: string }> = {
  done: { label: 'DONE', className: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' },
  'in-progress': { label: 'BUILDING', className: 'bg-sky-400/10 text-sky-300 border-sky-400/20' },
  todo: { label: 'TODO', className: 'bg-white/[0.04] text-slate-400 border-white/10' },
};

function progressOf(steps: BuildStep[]) {
  const total = steps.length;
  const done = steps.filter(step => step.status === 'done').length;
  const active = steps.filter(step => step.status === 'in-progress').length;
  return { total, done, active, percent: Math.round((done / total) * 100) };
}

export default function EngineBuildTrackerPage() {
  const progress = progressOf(BUILD_STEPS);
  const current = BUILD_STEPS.find(step => step.status === 'in-progress') ?? BUILD_STEPS[0];

  return (
    <DashboardShell view="engine">
      {() => (
        <div className="tce-mobile-view space-y-5 pb-8">
          <header className="space-y-3 px-1 pt-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Build Control
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-white">
                  Capital Rotation
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  CRDE implementation tracker · demo gate
                </p>
              </div>
              <Link
                href="/engines"
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 active:bg-white/5"
              >
                Engines
              </Link>
            </div>

            <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                  <Workflow className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white">
                      {progress.done}/{progress.total} phases complete
                    </span>
                    <span className="text-xs font-semibold text-sky-300">
                      {progress.percent}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-sky-400 transition-all"
                      style={{ width: progress.percent + '%' }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Current: <span className="text-slate-300">{current.title}</span>
                  </p>
                </div>
              </div>
            </section>
          </header>

          <section className="grid grid-cols-3 gap-2">
            <Metric label="Done" value={String(progress.done)} icon={<CheckCircle2 className="size-4" />} />
            <Metric label="Building" value={String(progress.active)} icon={<Clock3 className="size-4" />} />
            <Metric label="Remaining" value={String(progress.total - progress.done)} icon={<Circle className="size-4" />} />
          </section>

          <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-300" />
              <div>
                <h2 className="text-sm font-semibold text-amber-200">Demo rule</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  A phase is only considered complete after its deliverables are implemented,
                  verified, and this tracker is updated to DONE. Live cash stays behind the final
                  demo-readiness gate.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            {BUILD_STEPS.map(step => {
              const meta = statusMeta[step.status];
              return (
                <article
                  key={step.id}
                  className={
                    'rounded-3xl border p-4 ' +
                    (step.status === 'in-progress'
                      ? 'border-sky-400/25 bg-sky-400/[0.035]'
                      : 'border-white/10 bg-white/[0.025]')
                  }
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={
                        'flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ' +
                        (step.status === 'done'
                          ? 'bg-emerald-400/10 text-emerald-300'
                          : step.status === 'in-progress'
                            ? 'bg-sky-400/10 text-sky-300'
                            : 'bg-white/5 text-slate-500')
                      }
                    >
                      {step.phase}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h2 className="text-sm font-semibold text-white">{step.title}</h2>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
                        </div>
                        <span
                          className={
                            'shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide ' +
                            meta.className
                          }
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <div className="rounded-2xl bg-black/10 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                            Deliverables
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {step.deliverables.map(item => (
                              <span
                                key={item}
                                className="rounded-lg border border-white/10 bg-white/[0.025] px-2 py-1 text-[11px] text-slate-400"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <GitPullRequest className="size-3.5" />
                          Verification: {step.verification}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex items-center gap-1.5 text-slate-500">{icon}<span className="text-[11px]">{label}</span></div>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
