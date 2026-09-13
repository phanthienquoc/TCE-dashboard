'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import DashboardShell from '../../../../components/dashboard/DashboardShell';
import { api } from '../../../../lib/api';

const DEFAULTS = { enabled: false, profitTargetPct: 10, intervalMinutes: 60 };
type Config = typeof DEFAULTS & { lastRunAt: string | null };

export default function CronManagementPage() {
  const params = useParams<{ cronid: string }>();
  const [config, setConfig] = useState<Config>({ ...DEFAULTS, lastRunAt: null });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api.get<Config>('/profit-exit-settings').then(r => setConfig(r.data)).catch(() => setMessage('Unable to load cron configuration'));
  }, []);

  async function save() {
    setSaving(true); setMessage(null);
    try { const r = await api.post<Config>('/profit-exit-settings', config); setConfig(r.data); setMessage('Saved'); }
    catch { setMessage('Unable to save'); }
    finally { setSaving(false); }
  }

  const title = params.cronid === 'auto-profit-exit' ? 'Auto Profit Exit' : params.cronid;
  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view space-y-6">
          <header className="px-1 pt-2">
            <Link href="/settings/cron" className="mb-4 inline-flex items-center gap-1 text-sm text-sky-300"><ChevronLeft className="size-4" /> Cron Jobs</Link>
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            <p className="mt-1 text-sm text-slate-400">Configure when TCE creates profit-exit SELL orders.</p>
          </header>

          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              <label className="flex min-h-[72px] items-center gap-4 px-4">
                <span className="flex-1"><strong className="block text-[16px] text-white">Enabled</strong><span className="text-sm text-slate-400">Run during Vietnam market sessions</span></span>
                <input type="checkbox" className="size-5 accent-sky-400" checked={config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} />
              </label>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Schedule</p>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              <label className="flex min-h-[72px] items-center gap-4 border-b border-white/10 px-4"><span className="flex-1"><strong className="block text-[16px] text-white">Profit Target</strong><span className="text-sm text-slate-400">Percent above total buy cost</span></span><input className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-white" type="number" min="0" max="1000" step="0.5" value={config.profitTargetPct} onChange={e => setConfig(c => ({ ...c, profitTargetPct: Number(e.target.value) }))} /></label>
              <label className="flex min-h-[72px] items-center gap-4 px-4"><span className="flex-1"><strong className="block text-[16px] text-white">Run Every</strong><span className="text-sm text-slate-400">Scheduler check interval</span></span><input className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-white" type="number" min="1" max="1440" value={config.intervalMinutes} onChange={e => setConfig(c => ({ ...c, intervalMinutes: Number(e.target.value) }))} /></label>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Runtime</p>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              <div className="flex min-h-[60px] items-center px-4"><span className="flex-1 text-sm text-slate-300">Last Run</span><span className="text-sm text-white">{config.lastRunAt ? new Date(config.lastRunAt).toLocaleString() : 'Never'}</span></div>
              <div className="flex min-h-[60px] items-center border-t border-white/10 px-4"><span className="flex-1 text-sm text-slate-300">Order Policy</span><span className="text-sm text-emerald-300">Guarded READY</span></div>
            </div>
          </section>

          <button type="button" disabled={saving} onClick={() => void save()} className="w-full rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
          {message && <p className="text-center text-sm text-slate-400">{message}</p>}
        </div>
      )}
    </DashboardShell>
  );
}
