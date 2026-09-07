'use client';

import { CalendarDays, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useStockDividendPoolStore } from '../../lib/stock-dividend-pool-store';
import {
  Button,
  Caption,
  Eyebrow,
  Subheadline,
  Table,
  Title2,
  type TableColumn,
} from '../../shareComponent';

type Item = ReturnType<typeof useStockDividendPoolStore.getState>['items'][number];

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

export default function StockDividendPoolPage() {
  const items = useStockDividendPoolStore(s => s.items);
  const loading = useStockDividendPoolStore(s => s.loading);
  const error = useStockDividendPoolStore(s => s.error);
  const load = useStockDividendPoolStore(s => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumn<Item>[] = [
    {
      key: 'rank',
      label: '#',
      render: item => <span className="font-semibold text-foreground">{item.rank}</span>,
    },
    {
      key: 'ticker',
      label: 'Stock',
      render: item => (
        <div>
          <div className="font-semibold text-foreground">{item.ticker}</div>
          <Caption>{formatDate(item.exDividendDate)}</Caption>
        </div>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      render: item => (
        <span className="font-semibold text-foreground">{item.score.toFixed(2)}</span>
      ),
    },
    {
      key: 'dividendYieldPct',
      label: 'Yield',
      render: item => <span>{item.dividendYieldPct.toFixed(2)}%</span>,
    },
    {
      key: 'dividendValue',
      label: 'Dividend',
      render: item => (
        <span>{item.dividendValue ? item.dividendValue.toLocaleString('vi-VN') : '—'}</span>
      ),
    },
    {
      key: 'daysToExDate',
      label: 'Ex-date',
      render: item => <span>{item.daysToExDate === 0 ? 'Today' : `In ${item.daysToExDate}d`}</span>,
    },
    {
      key: 'eventContent',
      label: 'Event',
      render: item => (
        <div className="max-w-xl truncate">
          {item.eventContent || 'Dividend event'}
          <Caption>{item.dividendRate || '—'}</Caption>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout activeId="events">
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-4">
        <header className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              <Eyebrow>Stock strategy</Eyebrow>
            </div>
            <Title2 className="mt-1">Stock Dividend Pool</Title2>
            <Subheadline className="mt-1">
              Top 20 dividend candidates ranked from upcoming stock events.
            </Subheadline>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Refresh dividend pool"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </header>
        {error ? (
          <section className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </section>
        ) : null}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface-strong p-4">
            <Eyebrow>Pool size</Eyebrow>
            <div className="mt-1 text-2xl font-semibold text-foreground">{items.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface-strong p-4">
            <Eyebrow>Top score</Eyebrow>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {items[0]?.score?.toFixed(2) ?? '—'}
            </div>
          </div>
        </section>
        <section>
          {loading && !items.length ? (
            <div className="rounded-xl border border-border bg-surface-strong p-8 text-sm text-muted">
              Loading dividend pool…
            </div>
          ) : (
            <Table
              rows={items}
              columns={columns}
              getRowKey={item => item.id}
              empty="No upcoming dividend candidates."
            />
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
