'use client';
import { ChevronRight, Power, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { dashboardApi } from '../../lib/api';
import {
  loadEngineControlData,
  normalizeEngineControlReadFailure,
  type EngineControlConfig,
} from '../../lib/engine-control-data';
import { useTCEDataStore } from '../../lib/tce-data-store';
import { ENGINE_REGISTRY, EngineId } from './engine-registry';

export default function EngineControlPanel() {
  const cachedEngines = useTCEDataStore(s => s.engines);
  const [configs, setConfigs] = useState<EngineControlConfig[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError(null);

    void loadEngineControlData(controller.signal)
      .then(({ states, configs: dbConfigs }) => {
        if (!active || controller.signal.aborted) return;
        const byId = new Map(dbConfigs.map(row => [row.engineId, row]));
        const stateById = new Map(states.map(row => [row.engineId, row]));
        const merged = ENGINE_REGISTRY.map(definition => ({
          engineId: definition.id,
          enabled:
            byId.get(definition.id)?.enabled ??
            String(stateById.get(definition.id)?.status).toUpperCase() === 'ACTIVE',
          config: { ...definition.defaults, ...(byId.get(definition.id)?.config ?? {}) },
          updatedAt: byId.get(definition.id)?.updatedAt ?? null,
        }));
        setConfigs(merged);
        setEnabled(Object.fromEntries(merged.map(row => [row.engineId, row.enabled])));
        setLoadError(null);
        setLoading(false);
      })
      .catch(error => {
        if (!active || controller.signal.aborted) return;
        const failure = normalizeEngineControlReadFailure(error);
        if (failure.kind === 'cancelled') return;
        setLoadError(failure.message);
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [cachedEngines, loadAttempt]);

  function retryLoad() {
    setLoading(true);
    setLoadError(null);
    setLoadAttempt(attempt => attempt + 1);
  }

  async function toggle(id: EngineId) {
    if (loading || updating || loadError) return;
    const nextEnabled = !enabled[id];
    const previous = enabled[id];
    setEnabled(current => ({ ...current, [id]: nextEnabled }));
    setUpdating(id);
    try {
      await dashboardApi.setEngineConfig({ engineId: id, enabled: nextEnabled });
      setConfigs(current =>
        current.map(row => (row.engineId === id ? { ...row, enabled: nextEnabled } : row))
      );
    } catch {
      setEnabled(current => ({ ...current, [id]: previous }));
    } finally {
      setUpdating(null);
    }
  }

  const activeCount = Object.values(enabled).filter(Boolean).length;
  const statusLabel = loading
    ? configs.length > 0
      ? 'REFRESHING'
      : 'LOADING'
    : loadError
      ? configs.length > 0
        ? 'STALE'
        : 'UNAVAILABLE'
      : `${activeCount} ACTIVE`;

  return (
    <section className="engine-control-section">
      <div className="page-heading engine-control-heading">
        <div className="min-w-0">
          <p className="eyebrow">Runtime</p>
          <h1>Engine Control</h1>
          <p className="page-subtitle">
            Engine state and configuration are loaded from the backend account configuration.
          </p>
        </div>
        <div className="hero-status">{statusLabel}</div>
      </div>
      <Card className="panel-card engine-list-card">
        {loading && configs.length === 0 ? (
          <p role="status" className="p-4 text-sm text-[var(--muted)]">
            Loading engine status and configuration…
          </p>
        ) : null}
        {loadError ? (
          <div
            role="alert"
            className="m-4 flex flex-col items-start gap-3 rounded-xl border border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] p-4 text-sm"
          >
            <p>{loadError}</p>
            {configs.length > 0 ? (
              <p className="text-xs text-[var(--muted)]">
                Showing the last successful snapshot. Controls are disabled until refresh succeeds.
              </p>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={retryLoad} disabled={loading}>
              Retry
            </Button>
          </div>
        ) : null}
        {configs.length > 0 ? (
          <div className="engine-list">
            {configs.map(engine => {
              const definition = ENGINE_REGISTRY.find(item => item.id === engine.engineId);
              if (!definition) return null;
              return (
                <div key={engine.engineId} className="engine-row">
                  <button
                    type="button"
                    aria-pressed={engine.enabled}
                    aria-label={`${engine.enabled ? 'Disable' : 'Enable'} ${definition.name}`}
                    disabled={loading || updating !== null || loadError !== null}
                    onClick={() => void toggle(engine.engineId as EngineId)}
                    className={`engine-power ${engine.enabled ? 'is-active' : ''} disabled:opacity-50`}
                  >
                    <Power className="size-4" />
                  </button>
                  <Link
                    href={engine.engineId === 'binance-xau' ? '/xau' : `/engines/${engine.engineId}`}
                    className="engine-copy"
                  >
                    <div className="engine-title-row">
                      <p>{definition.name}</p>
                      <span>{definition.category}</span>
                    </div>
                    <p className="engine-description">{definition.description}</p>
                  </Link>
                  <div className="engine-meta">
                    <span className={engine.enabled ? 'is-active-text' : ''}>
                      {engine.enabled ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <ChevronRight className="size-4" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>
      <div className="engine-note">
        <Settings2 className="size-3.5 shrink-0" />
        Configuration is persisted per account; registry values are fallback defaults only.
      </div>
    </section>
  );
}
