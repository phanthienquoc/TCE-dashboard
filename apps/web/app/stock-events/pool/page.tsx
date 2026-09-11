'use client';

import { CalendarDays, Filter, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../../components/dashboard/DashboardLayout';
import { useStockDividendPoolStore, type StockDividendPoolItem } from '../../../lib/stock-dividend-pool-store';
import { Button, Caption, Eyebrow, Subheadline, Table, Title2, type TableColumn } from '../../../shareComponent';

function date(value: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('vi-VN');
}

function monthKey(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return `${String(month).padStart(2, '0')}/${year}`;
}

export default function StockDividendPoolPage() {
  const items = useStockDividendPoolStore(s => s.items);
  const loading = useStockDividendPoolStore(s => s.loading);
  const error = useStockDividendPoolStore(s => s.error);
  const load = useStockDividendPoolStore(s => s.load);
  const [month, setMonth] = useState(currentMonth);
  const [sort, setSort] = useState<'score' | 'yield' | 'exDate'>('score');

  useEffect(() => void load(), [load]);

  const months = useMemo(() => {
    const values = new Set(items.map(item => monthKey(item.exDividendDate)).filter(Boolean) as string[]);
    values.add(month);
    return [...values].sort().reverse();
  }, [items, month]);

  const filteredItems = useMemo(() => {
    const result = items.filter(item => monthKey(item.exDividendDate) === month);
    return [...result].sort((a, b) => {
      if (sort === 'yield') return b.dividendYieldPct - a.dividendYieldPct;
      if (sort === 'exDate') return new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime();
      return b.score - a.score;
    });
  }, [items, month, sort]);

  const columns: TableColumn<StockDividendPoolItem>[] = [
    { key: 'rank', label: '#', className: 'w-12', render: (_, index) => <span className="font-semibold">{index + 1}</span> },
    { key: 'ticker', label: 'Stock', render: row => <div><div className="font-semibold text-foreground">{row.ticker}</div><Caption>{row.dividendYieldPct.toFixed(2)}% yield</Caption></div> },
    { key: 'dividendValue', label: 'Dividend', render: row => <div><div className="font-semibold text-foreground">{row.dividendValue.toLocaleString('vi-VN')}</div><Caption>{row.dividendRate || '—'}</Caption></div> },
    { key: 'exDividendDate', label: 'Ex-date', render: row => <div><div className="font-medium text-foreground">{date(row.exDividendDate)}</div><Caption>{row.daysToExDate <= 0 ? 'Today' : `${row.daysToExDate}d`}</Caption></div> },
    { key: 'paymentDate', label: 'Payment', render: row => date(row.paymentDate) },
    { key: 'score', label: 'Score', className: 'text-right', render: row => <span className="font-semibold">{row.score.toFixed(1)}</span> },
  ];

  return (
    <DashboardLayout activeId="events">
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-4">
        <header><Eyebrow>Stock strategy</Eyebrow><Title2 className="mt-1">Dividend Pool</Title2><Subheadline className="mt-1">Dividend candidates filtered by ex-dividend month and ranked by TCE criteria.</Subheadline></header>
        {error ? <section className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</section> : null}
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-strong p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted"><Filter className="h-4 w-4" /> Ex-date month</div>
          <div className="flex gap-1 overflow-x-auto">
            {months.map(value => <Button key={value} variant={value === month ? 'primary' : 'secondary'} size="sm" onClick={() => setMonth(value)}><CalendarDays className="mr-1.5 h-4 w-4" />{monthLabel(value)}</Button>)}
          </div>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant={sort === 'score' ? 'primary' : 'secondary'} onClick={() => setSort('score')}>Score</Button>
            <Button size="sm" variant={sort === 'yield' ? 'primary' : 'secondary'} onClick={() => setSort('yield')}>Yield</Button>
            <Button size="sm" variant={sort === 'exDate' ? 'primary' : 'secondary'} onClick={() => setSort('exDate')}>Ex-date</Button>
            <Button size="sm" variant="secondary" onClick={() => void load()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-surface-strong p-4">
          {loading && !items.length ? <div className="p-6 text-sm text-muted">Loading dividend pool…</div> : <Table rows={filteredItems} columns={columns} getRowKey={row => row.id} empty={`No dividend candidates with ex-date in ${monthLabel(month)}.`} />}
        </section>
      </div>
    </DashboardLayout>
  );
}
