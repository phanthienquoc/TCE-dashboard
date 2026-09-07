'use client';

import { CalendarDays, Database, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { stockEventsApi } from '../../lib/api';
import { useAuthStore } from '../../lib/store';

type StockEvent = {
  id: string;
  ticker: string;
  exDividendDate: string;
  exDividendTimestamp: string | null;
  eventContent: string;
  dividendRate: string;
  dividendValue: number;
};

function daysUntil(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export default function StockEventsPage() {
  const user = useAuthStore(s => s.user);
  const initialized = useAuthStore(s => s.initialized);
  const authLoading = useAuthStore(s => s.loading);
  const init = useAuthStore(s => s.init);
  const [events, setEvents] = useState<StockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => void init(), [init]);
  useEffect(() => {
    if (!initialized || !user) return;
    void (async () => {
      try {
        setLoading(true);
        const response = await stockEventsApi.upcoming(200);
        setEvents(Array.isArray(response.data) ? response.data : []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load stock events');
      } finally {
        setLoading(false);
      }
    })();
  }, [initialized, user]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const rows = text
      ? events.filter(event => `${event.ticker} ${event.eventContent}`.toLowerCase().includes(text))
      : events;
    // Do not dedupe by ticker: a stock can pay dividends 2–3 times per year.
    // Only collapse an accidental exact duplicate event record.
    return Array.from(
      new Map(rows.map(event => [`${event.ticker}|${event.exDividendDate}|${event.eventContent}`, event])).values()
    );
  }, [events, query]);

  const uniqueTickers = new Set(filtered.map(event => event.ticker)).size;

  if (authLoading || !initialized || !user) {
    return <main className="app-shell"><div className="app-container app-content"><div className="loading-state p-4">Opening TCE…</div></div></main>;
  }

  return (
    <DashboardLayout activeId="events">
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-4">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted"><CalendarDays className="size-4" />Corporate events</div>
            <h1 className="mt-1 text-xl font-semibold">Stock Events</h1>
            <p className="mt-1 text-sm text-muted">Upcoming dividend events from the live stock-dividend database.</p>
          </div>
          <label className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ticker or event…" className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none" />
          </label>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-4"><div className="text-xs text-muted">Upcoming events</div><div className="mt-1 text-2xl font-semibold">{filtered.length}</div></div>
          <div className="rounded-xl border p-4"><div className="text-xs text-muted">Stocks</div><div className="mt-1 text-2xl font-semibold">{uniqueTickers}</div></div>
          <div className="hidden rounded-xl border p-4 md:block"><div className="flex items-center gap-2 text-xs text-muted"><Database className="size-3.5" />Source</div><div className="mt-1 text-sm font-medium">vietstock.events</div></div>
        </div>

        <section className="overflow-hidden rounded-xl border">
          {loading ? <div className="p-8 text-sm text-muted">Loading latest events…</div> : null}
          {error ? <div className="p-8 text-sm text-destructive">{error}</div> : null}
          {!loading && !error && filtered.length === 0 ? <div className="p-8 text-sm text-muted">No upcoming events.</div> : null}
          {!loading && !error && filtered.length > 0 ? (
            <div className="divide-y">
              {filtered.map(event => {
                const days = daysUntil(event.exDividendTimestamp ?? event.exDividendDate);
                return (
                  <article key={event.id} className="grid gap-3 p-4 md:grid-cols-[90px_110px_1fr_130px] md:items-center">
                    <div><div className="font-semibold">{event.ticker}</div><div className="text-xs text-muted">{event.exDividendDate || '—'}</div></div>
                    <div><div className="text-xs text-muted">Timing</div><div className="font-medium">{days == null ? '—' : days <= 0 ? 'Today' : `In ${days}d`}</div></div>
                    <div className="min-w-0"><div className="truncate text-sm">{event.eventContent || 'Dividend event'}</div><div className="mt-1 text-xs text-muted">{event.dividendRate || '—'}</div></div>
                    <div className="md:text-right"><div className="font-semibold">{event.dividendValue ? event.dividendValue.toLocaleString('vi-VN') : '—'}</div><div className="text-xs text-muted">dividend / event</div></div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </DashboardLayout>
  );
}
