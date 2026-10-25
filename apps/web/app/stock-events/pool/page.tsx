'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../../components/dashboard/DashboardLayout';
import { DividendOneYearCandleChart } from '../../../components/dashboard/DividendOneYearCandleChart';
import {
  useStockDividendPoolStore,
  type StockDividendPoolItem,
} from '../../../lib/stock-dividend-pool-store';
import {
  Button,
  Caption,
  Eyebrow,
  Subheadline,
  Table,
  Title2,
  type TableColumn,
} from '../../../shareComponent';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${m}/${y}`;
};

const monthOptions = () => {
  const d = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  });
};

const date = (value: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('vi-VN');
};

export default function StockDividendPoolPage() {
  const items = useStockDividendPoolStore(s => s.items);
  const loading = useStockDividendPoolStore(s => s.loading);
  const error = useStockDividendPoolStore(s => s.error);
  const load = useStockDividendPoolStore(s => s.load);
  const [month, setMonth] = useState(currentMonth);
  const [sort, setSort] = useState<'score' | 'yield' | 'exDate'>('score');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  useEffect(() => void load(month), [load, month]);

  const rows = useMemo(
    () =>
      [...items].sort((a, b) =>
        sort === 'yield'
          ? b.dividendYieldPct - a.dividendYieldPct
          : sort === 'exDate'
            ? new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime()
            : b.score - a.score
      ),
    [items, sort]
  );

  const columns: TableColumn<StockDividendPoolItem>[] = [
    {
      key: 'rank',
      label: '#',
      className: 'w-12',
      render: (_, i) => <span className="font-semibold">{i + 1}</span>,
    },
    {
      key: 'ticker',
      label: 'Stock',
      render: r => {
        const expanded = expandedTicker === r.ticker;
        return (
          <button
            type="button"
            className="w-full text-left"
            onClick={() => setExpandedTicker(expanded ? null : r.ticker)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${r.ticker}`}
          >
            <div className="font-semibold text-foreground">{r.ticker}</div>
            <Caption>{r.dividendYieldPct.toFixed(2)}% yield</Caption>
            {expanded ? <DividendOneYearCandleChart symbol={r.ticker} /> : null}
          </button>
        );
      },
    },
    {
      key: 'dividendValue',
      label: 'Dividend',
      render: r => (
        <div>
          <div className="font-semibold text-foreground">
            {r.dividendValue.toLocaleString('vi-VN')}
          </div>
          <Caption>{r.dividendRate || '—'}</Caption>
        </div>
      ),
    },
    {
      key: 'exDividendDate',
      label: 'Ex-date',
      render: r => (
        <div>
          <div className="font-medium text-foreground">{date(r.exDividendDate)}</div>
          <Caption>{r.daysToExDate <= 0 ? 'Today' : `${r.daysToExDate}d`}</Caption>
        </div>
      ),
    },
    { key: 'paymentDate', label: 'Payment', render: r => date(r.paymentDate) },
    {
      key: 'score',
      label: 'Score',
      className: 'text-right',
      render: r => <span className="font-semibold">{r.score.toFixed(1)}</span>,
    },
  ];

  const months = useMemo(monthOptions, []);

  return (
    <DashboardLayout activeId="events">
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-4">
        <header>
          <Eyebrow>Stock strategy</Eyebrow>
          <Title2 className="mt-1">Dividend Pool</Title2>
          <Subheadline className="mt-1">
            Dividend candidates filtered by ex-dividend month and ranked by TCE criteria.
          </Subheadline>
        </header>

        {error ? (
          <section className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </section>
        ) : null}

        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-strong p-3">
          <label htmlFor="dividend-month" className="text-sm font-medium text-muted">
            Ex-date month
          </label>
          <select
            id="dividend-month"
            value={month}
            onChange={event => {
              setMonth(event.target.value);
              setExpandedTicker(null);
            }}
            className="min-w-36 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/40"
          >
            {months.map(value => (
              <option key={value} value={value}>
                {monthLabel(value)}
              </option>
            ))}
          </select>

          <div className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant={sort === 'score' ? 'primary' : 'secondary'}
              onClick={() => setSort('score')}
            >
              Score
            </Button>
            <Button
              size="sm"
              variant={sort === 'yield' ? 'primary' : 'secondary'}
              onClick={() => setSort('yield')}
            >
              Yield
            </Button>
            <Button
              size="sm"
              variant={sort === 'exDate' ? 'primary' : 'secondary'}
              onClick={() => setSort('exDate')}
            >
              Ex-date
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void load(month)}
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface-strong p-4">
          {loading ? (
            <div className="p-6 text-sm text-muted">Loading dividend pool…</div>
          ) : (
            <Table
              rows={rows}
              columns={columns}
              getRowKey={r => r.id}
              empty={`No dividend candidates with ex-date in ${monthLabel(month)}.`}
            />
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
