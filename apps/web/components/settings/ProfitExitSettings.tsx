'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const DEFAULTS = { enabled: false, profitTargetPct: 10, intervalMinutes: 60 };
type Config = typeof DEFAULTS & { lastRunAt: string | null };

export default function ProfitExitSettings() {
  const [config, setConfig] = useState<Config>({ ...DEFAULTS, lastRunAt: null });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api
      .get<Config>('/profit-exit-settings')
      .then(response => {
        if (active) setConfig(response.data);
      })
      .catch(() => {
        if (active) setError('Unable to load automatic profit-exit settings');
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await api.post<Config>('/profit-exit-settings', config);
      setConfig(response.data);
      setSaved(true);
    } catch {
      setError('Unable to save automatic profit-exit settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="tce-settings-card">
      <div className="tce-section-row">
        <div>
          <span className="tce-label">AUTOMATIC PROFIT EXIT</span>
          <strong>Protect profitable stock positions</strong>
          <p className="mt-1 text-sm text-muted">
            Creates one pending SELL order when market value reaches the configured profit target
            versus total buy cost.
          </p>
        </div>
        <label className="tce-settings-toggle">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={event =>
              setConfig(current => ({ ...current, enabled: event.target.checked }))
            }
          />
          <span>{config.enabled ? 'ON' : 'OFF'}</span>
        </label>
      </div>
      <div className="tce-stat-grid">
        <label className="tce-row-card">
          <span>Profit target %</span>
          <input
            type="number"
            min="0"
            max="1000"
            step="0.5"
            value={config.profitTargetPct}
            onChange={event =>
              setConfig(current => ({ ...current, profitTargetPct: Number(event.target.value) }))
            }
          />
        </label>
        <label className="tce-row-card">
          <span>Run every (minutes)</span>
          <input
            type="number"
            min="1"
            max="1440"
            step="1"
            value={config.intervalMinutes}
            onChange={event =>
              setConfig(current => ({ ...current, intervalMinutes: Number(event.target.value) }))
            }
          />
        </label>
      </div>
      <div className="tce-section-row">
        <small>Default: 10% profit · every 60 minutes · VN market hours only</small>
        <button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {saved && <small className="tce-positive">Saved</small>}
      {error && <small className="tce-negative">{error}</small>}
      {config.lastRunAt && <small>Last run: {new Date(config.lastRunAt).toLocaleString()}</small>}
    </section>
  );
}
