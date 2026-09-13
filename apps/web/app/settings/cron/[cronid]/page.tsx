'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
    setSaving(true);
    setMessage(null);
    try {
      const r = await api.post<Config>('/profit-exit-settings', config);
      setConfig(r.data);
      setMessage('Cron configuration saved');
    } catch {
      setMessage('Unable to save cron configuration');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell view="settings">
      {() => (
        <main className="tce-settings-card">
          <div className="tce-section-row">
            <div>
              <span className="tce-label">CRON MANAGEMENT</span>
              <h1>Automatic Profit Exit</h1>
              <p className="text-sm text-muted">Job ID: {params.cronid}</p>
            </div>
            <label className="tce-settings-toggle"><input type="checkbox" checked={config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} /><span>{config.enabled ? 'ON' : 'OFF'}</span></label>
          </div>
          <div className="tce-stat-grid">
            <label className="tce-row-card"><span>Profit target</span><input type="number" min="0" max="1000" step="0.5" value={config.profitTargetPct} onChange={e => setConfig(c => ({ ...c, profitTargetPct: Number(e.target.value) }))} /><small>% of total buy cost</small></label>
            <label className="tce-row-card"><span>Interval</span><input type="number" min="1" max="1440" value={config.intervalMinutes} onChange={e => setConfig(c => ({ ...c, intervalMinutes: Number(e.target.value) }))} /><small>minutes</small></label>
          </div>
          <div className="tce-section-row"><small>Default: OFF · 10% · 60 minutes · VN market session only</small><button type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save cron'}</button></div>
          {message && <small>{message}</small>}
          {config.lastRunAt && <small>Last run: {new Date(config.lastRunAt).toLocaleString()}</small>}
        </main>
      )}
    </DashboardShell>
  );
}
