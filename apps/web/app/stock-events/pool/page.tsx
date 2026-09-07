'use client';

import { useEffect } from 'react';
import DashboardLayout from '../../../components/dashboard/DashboardLayout';
import {
  useStockDividendPoolStore,
  type StockDividendPoolItem,
} from '../../../lib/stock-dividend-pool-store';
import {
  Caption,
  Eyebrow,
  Subheadline,
  Table,
  Title2,
  type TableColumn,
} from '../../../shareComponent';

function date(value: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('vi-VN');
}

export default function StockDividendPoolPage() {
  const items = useStockDividendPoolStore(s => s.items);
  const loading = useStockDividendPoolStore(s => s.loading);
  const error = useStockDividendPoolStore(s => s.error);
  const load = useStockDividendPoolStore(s => s.load);

  useEffect(() => void load(), [load]);

  const columns: TableColumn<StockDividendPoolItem>[] = [
    {
      key: 'rank',
      label: '#',
      className: 'w-12',
      render: row => <span className="font-semibold">{row.rank}</span>,
    },
    {
      key: 'ticker',
      label: 'Stock',
      render: row => (
        <div>
          <div className="font-semibold text-foreground">{row.ticker}</div>
          <Caption>{row.dividendYieldPct.toFixed(2)}% yield</Caption>
        </div>
      ),
    },
    {
      key: 'dividendValue',
      label: 'Dividend',
      render: row => (
        <div>
          <div className="font-semibold text-foreground">
            {row.dividendValue.toLocaleString('vi-VN')}
          </div>
          <Caption>{row.dividendRate || '—'}</Caption>
        </div>
      ),
    },
    {
      key: 'exDividendDate',
      label: 'Ex-date',
      render: row => (
        <div>
          <div className="font-medium text-foreground">{date(row.exDividendDate)}</div>
          <Caption>{row.daysToExDate <= 0 ? 'Today' : `${row.daysToExDate}d`}</Caption>
        </div>
      ),
    },
    { key: 'paymentDate', label: 'Payment', render: row => date(row.paymentDate) },
    {
      key: 'score',
      label: 'Score',
      className: 'text-right',
      render: row => <span className="font-semibold">{row.score.toFixed(1)}</span>,
    },
  ];

  return (
    <DashboardLayout activeId="events">
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-4">
        <header>
          <Eyebrow>Stock strategy</Eyebrow>
          <Title2 className="mt-1">Dividend Pool</Title2>
          <Subheadline className="mt-1">
            Top 20 upcoming dividend candidates, ranked from MongoDB stock events.
          </Subheadline>
        </header>
        {error ? (
          <section className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </section>
        ) : null}
        <section className="rounded-xl border border-border bg-surface-strong p-4">
          {loading && !items.length ? (
            <div className="p-6 text-sm text-muted">Loading dividend pool…</div>
          ) : (
            <Table
              rows={items}
              columns={columns}
              getRowKey={row => row.id}
              empty="No dividend candidates."
            />
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
