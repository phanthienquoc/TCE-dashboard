'use client';

import { CalendarDays, Database, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useAuthStore } from '../../lib/store';
import { useStockEventStore, type StockEvent } from '../../lib/stock-event-store';
import {
  Button,
  Caption,
  Eyebrow,
  Input,
  Subheadline,
  Table,
  Title2,
  type TableColumn,
} from '../../shareComponent';

function daysUntil(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function timingLabel(event: StockEvent) {
  const days = daysUntil(event.exDividendTimestamp ?? event.exDividendDate);
  if (days == null) return '—';
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days}d`;
}

const eventKey = (event: StockEvent) =>
  `${event.ticker}|${event.exDividendDate}|${event.eventContent}`;

export default function StockEventsPage() {
  const user = useAuthStore(s => s.user);
  const initialized = useAuthStore(s => s.initialized);
  const authLoading = useAuthStore(s => s.loading);
  const init = useAuthStore(s => s.init);
  const events = useStockEventStore(s => s.events);
  const loading = useStockEventStore(s => s.loading);
  const error = useStockEventStore(s => s.error);
  const load = useStockEventStore(s => s.load);
  const [query, setQuery] = useState('');

  useEffect(() => void init(), [init]);
  useEffect(() => {
    if (initialized && user) void load();
  }, [initialized, user, load]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const rows = text
      ? events.filter(event =>
          `${event.ticker} ${event.eventContent} ${event.dividendRate}`.toLowerCase().includes(text)
        )
      : events;

    // A ticker may have multiple legitimate dividend events in one year.
    // Only collapse exact duplicate records; never dedupe by ticker alone.
    return Array.from(new Map(rows.map(event => [eventKey(event), event])).values());
  }, [events, query]);

  const uniqueTickers = new Set(filtered.map(event => event.ticker)).size;

  const columns: TableColumn<StockEvent>[] = [
    {
      key: 'ticker',
      label: 'Stock',
      render: event => (
        <div>
          <div className="font-semibold text-foreground">{event.ticker}</div>
          <Caption>{formatDate(event.exDividendDate)}</Caption>
        </div>
      ),
    },
    {
      key: 'timing',
      label: 'Ex-date',
      render: event => <span className="font-medium text-foreground">{timingLabel(event)}</span>,
    },
    {
      key: 'eventContent',
      label: 'Event',
      render: event => (
        <div className="min-w-0 max-w-xl">
          <div className="truncate font-medium text-foreground">
            {event.eventContent || 'Dividend event'}
          </div>
          <Caption>{event.dividendRate || '—'}</Caption>
        </div>
      ),
    },
    {
      key: 'dividendValue',
      label: 'Dividend',
      className: 'text-right',
      render: event => (
        <div className="text-right">
          <div className="font-semibold text-foreground">
            {event.dividendValue ? event.dividendValue.toLocaleString('vi-VN') : '—'}
          </div>
          <Caption>per event</Caption>
        </div>
      ),
    },
  ];

  if (authLoading || !initialized || !user) {
    return (
      <main className="app-shell">
        <div className="app-container app-content">
          <div className="loading-state p-4">Opening TCE…</div>
        </div>
      </main>
    );
  }

  return (
    <DashboardLayout activeId="events">
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-4">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              <Eyebrow>Corporate events</Eyebrow>
            </div>
            <Title2 className="mt-1">Stock Events</Title2>
            <Subheadline className="mt-1">
              Upcoming dividend events. Multiple payments for the same stock remain separate.
            </Subheadline>
          </div>

          <div className="flex w-full gap-2 md:w-[360px]">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search stock or event…"
                className="pl-9"
              />
            </label>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Refresh stock events"
              title="Refresh"
              onClick={() => void load(200, true)}
              disabled={loading}
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface-strong p-4">
            <Eyebrow>Upcoming events</Eyebrow>
            <div className="mt-1 text-2xl font-semibold text-foreground">{filtered.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface-strong p-4">
            <Eyebrow>Stocks</Eyebrow>
            <div className="mt-1 text-2xl font-semibold text-foreground">{uniqueTickers}</div>
          </div>
          <div className="hidden rounded-xl border border-border bg-surface-strong p-4 md:block">
            <div className="flex items-center gap-2">
              <Database className="size-3.5 text-muted" />
              <Eyebrow>Source</Eyebrow>
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">Stock Dividend feed</div>
          </div>
        </section>

        {error ? (
          <section className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </section>
        ) : null}

        <section>
          {loading && !events.length ? (
            <div className="rounded-xl border border-border bg-surface-strong p-8 text-sm text-muted">
              Loading latest events…
            </div>
          ) : (
            <Table
              rows={filtered}
              columns={columns}
              getRowKey={eventKey}
              empty={query ? 'No matching stock events.' : 'No upcoming stock events.'}
            />
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
