'use client';

import * as React from 'react';
import { Check, ChevronDown, ChevronRight, RefreshCw, Zap } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';

export type EngineValue = string | number | boolean;
export type ActionResult = { ok: boolean; message: string };

export function RuntimeMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-0.5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
      {action}
    </div>
  );
}

export function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true);
  return (
    <Card className="panel-card">
      <button type="button" onClick={() => setOpen(value => !value)} className="flex min-h-12 w-full items-center justify-between px-4 text-left">
        <span className="flex items-center gap-2 font-semibold">{title}</span>
        <ChevronDown className={`size-4 text-muted transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open ? <CardContent className="divide-y divide-[var(--line)] p-0">{children}</CardContent> : null}
    </Card>
  );
}

export function ConfigField({
  keyName,
  value,
  onChange,
}: {
  keyName: string;
  value: EngineValue;
  onChange: (value: EngineValue) => void;
}) {
  const description = fieldDescription(keyName);
  const boolean = typeof value === 'boolean';

  return (
    <div className="flex min-h-[68px] items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{labelize(keyName)}</p>
        {description ? <p className="mt-0.5 text-[11px] leading-4 text-muted">{description}</p> : null}
      </div>
      {boolean ? (
        <button
          type="button"
          role="switch"
          aria-checked={value}
          onClick={() => onChange(!value)}
          className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition ${value ? 'bg-[var(--accent)]' : 'bg-white/10'}`}
        >
          <span className={`block size-6 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : ''}`} />
        </button>
      ) : (
        <div className="relative w-[145px] shrink-0">
          <input
            type={typeof value === 'number' ? 'number' : 'text'}
            inputMode={typeof value === 'number' ? 'decimal' : undefined}
            value={String(value)}
            onChange={event => onChange(typeof value === 'number' ? Number(event.target.value) : event.target.value)}
            className="h-11 w-full rounded-xl border border-[var(--line)] bg-white/[0.03] px-3 text-right text-sm outline-none focus:border-[var(--accent)]/40"
          />
          {suffixFor(keyName) ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffixFor(keyName)}</span> : null}
        </div>
      )}
    </div>
  );
}

export function SyncAction({
  title,
  description,
  loading,
  onClick,
}: {
  title: string;
  description: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex min-h-[60px] w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 text-left transition active:bg-white/[0.04]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
        {loading ? <RefreshCw className="size-4 animate-spin" /> : <Zap className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </button>
  );
}

export function ResultBanner({ result }: { result: ActionResult }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-xs ${result.ok ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200' : 'border-red-300/15 bg-red-300/[0.05] text-red-200'}`}>
      {result.message}
    </div>
  );
}

export function ActivityItem({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{value}</span>
      </span>
      <Check className="size-4 text-emerald-400" />
    </div>
  );
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export function formatValue(key: string, value: EngineValue) {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'number') {
    if (/capital/i.test(key)) return `${new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} ₫`;
    if (/pct/i.test(key)) return `${value}%`;
    if (/interval/i.test(key)) return `${value} min`;
    if (/seconds/i.test(key)) return `${value} s`;
    return new Intl.NumberFormat('vi-VN').format(value);
  }
  return value.replace('Asia/Ho_Chi_Minh', 'Asia/Ho Chi Minh');
}

function suffixFor(key: string) {
  if (/capital/i.test(key)) return '₫';
  if (/pct/i.test(key)) return '%';
  if (/interval/i.test(key)) return 'min';
  if (/seconds/i.test(key)) return 's';
  return '';
}

function fieldDescription(key: string) {
  const descriptions: Record<string, string> = {
    poolSize: 'Number of candidates kept in the pool',
    maxPositions: 'Maximum concurrent positions',
    profitTargetPct: 'Target profit per position',
    maxAssetAllocationPct: 'Maximum allocation per asset',
    buyQuantityStep: 'Quantity step when buying',
    buyFromRemainingBudget: 'Use remaining available budget',
    coreCapital: 'Main capital for trading',
    burstCapital: 'Additional capital for opportunities',
    monitorIntervalMinutes: 'Scan interval during runtime',
    autoSellEnabled: 'Automatically sell positions',
    autoSellProfitTargetPct: 'Profit target for automatic selling',
    autoSellIntervalMinutes: 'Interval for automatic selling',
  };
  return descriptions[key];
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase());
}
