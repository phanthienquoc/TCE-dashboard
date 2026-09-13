'use client';

import { Clock3, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardShell from '../../../../components/dashboard/DashboardShell';
import { api } from '../../../../lib/api';

const DEFAULTS = { enabled: false, profitTargetPct: 10, intervalMinutes: 60 };
type Config = typeof DEFAULTS & { lastRunAt: string | null };

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><p className="mb-2 px-4 text-xs font-medium uppercase tracking-wide text-muted">{title}</p><div className="overflow-hidden rounded-2xl border border-violet-200/[0.08] bg-white/[0.035]">{children}</div></section>;
}
function Row({ label, detail, children }: { label: string; detail?: string; children: React.ReactNode }) {
  return <div className="flex min-h-16 items-center gap-3 border-b border-violet-200/[0.07] px-4 py-3 last:border-b-0"><div className="min-w-0 flex-1"><strong className="block text-sm text-white">{label}</strong>{detail && <span className="mt-0.5 block text-xs text-muted">{detail}</span>}</div>{children}</div>;
}

export default function CronManagementPage() {
  const { cronid } = useParams<{ cronid: string }>();
  const [config, setConfig] = useState<Config>({ ...DEFAULTS, lastRunAt: null });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void api.get<Config>('/profit-exit-settings').then(r => setConfig(r.data)).catch(() => setMessage('Unable to load cron configuration')); }, []);
  async function save() {
    setSaving(true); setMessage(null);
    try { const r = await api.post<Config>('/profit-exit-settings', config); setConfig(r.data); setMessage('Saved'); }
    catch { setMessage('Unable to save cron configuration'); }
    finally { setSaving(false); }
  }
  return <DashboardShell view="settings">{() => <div className="tce-mobile-view">
    <div className="py-2"><div className="flex items-center gap-3"><Clock3 className="size-6 text-white/80" /><div><p className="text-xs uppercase tracking-wide text-muted">Cron Job</p><h1 className="text-2xl font-semibold text-white">Automatic Profit Exit</h1></div></div><p className="mt-1 text-sm text-muted">{cronid}</p></div>
    <Group title="Status"><Row label="Enabled" detail="Run automatically during Vietnam market hours"><button type="button" role="switch" aria-checked={config.enabled} onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))} className={`relative h-8 w-14 rounded-full p-1 ${config.enabled ? 'bg-emerald-500/80' : 'bg-white/10'}`}><span className={`block size-6 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : ''}`} /></button></Row></Group>
    <Group title="Schedule"><Row label="Profit Target" detail="Compared with total buy cost"><input className="w-24 rounded-lg border border-violet-200/[0.08] bg-white/[0.04] px-3 py-2 text-right text-sm text-white" type="number" min="0" max="1000" step="0.5" value={config.profitTargetPct} onChange={e => setConfig(c => ({ ...c, profitTargetPct: Number(e.target.value) }))} /><span className="text-sm text-muted">%</span></Row><Row label="Run Every" detail="Scheduler checks once per minute"><input className="w-24 rounded-lg border border-violet-200/[0.08] bg-white/[0.04] px-3 py-2 text-right text-sm text-white" type="number" min="1" max="1440" value={config.intervalMinutes} onChange={e => setConfig(c => ({ ...c, intervalMinutes: Number(e.target.value) }))} /><span className="text-sm text-muted">min</span></Row><Row label="Market Session" detail="Vietnam"><span className="text-sm text-muted">09:00–11:30 · 13:00–14:45</span></Row></Group>
    <Group title="Runtime"><Row label="Last Run"><span className="text-sm text-muted">{config.lastRunAt ? new Date(config.lastRunAt).toLocaleString('vi-VN') : 'Never'}</span></Row><Row label="Order Policy" detail="One active SELL per account + symbol"><span className="text-sm text-muted">Guarded</span></Row></Group>
    <div className="flex items-center justify-end gap-3 px-4 py-2"><span className="text-xs text-muted">{message ?? 'Default: 10% · 60 minutes'}</span><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl border border-violet-200/[0.10] bg-white/[0.05] px-4 py-2.5 text-sm text-white disabled:opacity-50"><Save className="size-4" />{saving ? 'Saving…' : 'Save'}</button></div>
  </div>}</DashboardShell>;
}
