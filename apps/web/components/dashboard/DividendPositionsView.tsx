'use client';

import { ChevronDown, WalletCards, CircleDot, Tag, CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStockEventStore, type StockEvent } from '../../lib/stock-event-store';
import { useDashboardStore } from '../../lib/store';
import type { DashboardActions, DashboardData } from './DashboardShell';
import { DividendOneYearCandleChart } from './DividendOneYearCandleChart';

type ViewProps = { data: DashboardData; actions: DashboardActions };
type MonthGroup = { monthKey: string; cards: Array<{ symbol: string; events: StockEvent[] }> };

const PRICE_OPTIONS = Array.from({ length: 9 }, (_, index) => (index + 1) * 10_000);
const DEFAULT_PRICE_FILTER = 50_000;

export function DividendPositionsView({ data, actions }: ViewProps) {
  const [tab, setTab] = useState<'current' | 'dividend' | 'history'>('dividend');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [priceFilter, setPriceFilter] = useState(DEFAULT_PRICE_FILTER);
  const events = useStockEventStore(s => s.events);
  const loading = useStockEventStore(s => s.loading);
  const error = useStockEventStore(s => s.error);
  const load = useStockEventStore(s => s.load);
  const marketPrices = useDashboardStore(s => s.marketPrices);
  const syncMarketPrices = useDashboardStore(s => s.syncMarketPrices);

  useEffect(() => { void load(500, true, null); }, [load]);

  const monthGroups = useMemo(() => buildFutureMonthGroups(events).filter(group => group.monthKey === selectedMonth), [events, selectedMonth]);
  const monthOptions = useMemo(() => futureMonthKeys(), []);
  const symbolsKey = useMemo(() => monthGroups.flatMap(group => group.cards.map(card => card.symbol)).join(','), [monthGroups]);

  useEffect(() => {
    const symbols = [...new Set(monthGroups.flatMap(group => group.cards.map(card => card.symbol)))];
    if (!symbols.length) return;
    const snapshot = { pools: symbols.map(symbol => ({ symbol })) };
    void syncMarketPrices(snapshot);
    const timer = window.setInterval(() => void syncMarketPrices(snapshot), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [symbolsKey, syncMarketPrices]);

  return (
    <div className="tce-mobile-view">
      <header className="tce-mobile-header">
        <div className="tce-header-brand"><WalletCards className="size-5" /><div><strong>Positions</strong><span>Live exposure</span></div></div>
        <span className="tce-live-pill"><CircleDot className="size-3" /> LIVE</span>
      </header>
      <div className="tce-segmented">{(['current', 'dividend', 'history'] as const).map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
      {tab === 'current' && <div className="tce-list-stack">{data.positions.length ? data.positions.map((row, index) => <article className="tce-dividend-card" key={row.id ?? row.symbol ?? index}>
        <div className="flex items-center gap-2"><strong>{String(row.symbol ?? '—')}</strong><span className="tce-muted">Current position</span></div>
        <div className="tce-pool-grid mt-2"><div><span>Entry</span><b>{formatNumber(row.positionPrice ?? row.position_price ?? row.avgBuyCost ?? row.avg_cost)}</b></div><div><span>Now</span><b>{formatNumber(row.marketPrice ?? row.market_price ?? row.currentPrice ?? row.current_price)}</b></div><div><span>P&L</span><b>{formatNumber(row.pnl ?? row.unrealizedPnl ?? row.unrealized_pnl)}</b></div></div>
        <button className="tce-secondary-action mt-3" onClick={() => actions.openPositionSell(row)}>SELL</button>
      </article>) : <EmptyState text="No current positions" />}</div>}
      {tab === 'dividend' && <div className="tce-list-stack tce-dividend-month-groups">
        <div className="tce-dividend-filter-bar">
          <label className="tce-dividend-filter-field" htmlFor="positions-dividend-month">
            <CalendarDays className="size-4" aria-hidden="true" />
            <span><small>Ex-date month</small><select id="positions-dividend-month" value={selectedMonth} onChange={event => { setSelectedMonth(event.target.value); setExpanded(null); }} aria-label="Ex-date month">{monthOptions.map(month => <option key={month} value={month}>{dividendMonthLabel(month)}</option>)}</select></span>
          </label>
          <div className="tce-dividend-filter-divider" aria-hidden="true" />
          <label className="tce-dividend-filter-field" htmlFor="positions-current-price">
            <Tag className="size-4" aria-hidden="true" />
            <span><small>Current price (VND)</small><select id="positions-current-price" value={priceFilter} onChange={event => setPriceFilter(Number(event.target.value))} aria-label="Current price filter">{PRICE_OPTIONS.map(value => <option key={value} value={value}>{value.toLocaleString('vi-VN')}</option>)}</select></span>
          </label>
        </div>
        {loading ? <EmptyState text="Loading dividend events…" /> : error ? <EmptyState text={error} /> : monthGroups.length ? monthGroups.map(group => <section className="tce-dividend-month-group" key={group.monthKey}>
          <div className="tce-dividend-month-header" aria-label={`${dividendMonthLabel(group.monthKey)} events`}><span className="tce-dividend-month-title">{dividendMonthLabel(group.monthKey)}</span><span className="tce-dividend-month-count">{group.cards.length} {group.cards.length === 1 ? 'event' : 'events'}</span><ChevronDown className="tce-dividend-month-chevron is-open" aria-hidden="true" /></div>
          <div className="tce-list-stack tce-dividend-month-cards">{group.cards.map(item => {
            const pool = data.pools.find(p => String(p.symbol ?? p.code ?? '').toUpperCase() === item.symbol);
            const event = item.events[0];
            const livePrice = marketPrices[item.symbol]?.price;
            const marketPrice = Number(livePrice) > 0 ? livePrice : undefined;
            const price = marketPrice ?? event?.currentPrice ?? event?.price ?? pool?.currentPrice ?? pool?.current_price;
            const key = `${group.monthKey}:${item.symbol}`;
            return <article className="tce-dividend-card" key={key}>
              <button type="button" className="w-full text-left" onClick={() => setExpanded(expanded === key ? null : key)} aria-expanded={expanded === key}>
                <div className="flex items-center gap-2"><strong>{item.symbol}</strong>{event && <span className="tce-muted">{formatDate(event.exDividendTimestamp ?? event.exDividendDate ?? event.exDate)}</span>}<span className="ml-auto">{expanded === key ? '−' : '+'}</span></div>
                <div className="tce-pool-grid mt-2"><div><span>Dividend</span><b>{Number(event?.dividendValue ?? 0) ? `${money(Number(event?.dividendValue))} ₫` : '—'}</b></div><div><span>Current Price</span><b>{formatNumber(price)}</b></div><div><span>Yield</span><b>{formatPercent(event?.dividendYieldPct)}</b></div><div><span>1Y Low</span><b>{formatNumber(event?.oneYearLow)}</b></div><div><span>1Y High</span><b>{formatNumber(event?.oneYearHigh)}</b></div><div><span>1Y Range</span><b>{formatRange(event?.oneYearLow, event?.oneYearHigh)}</b></div></div>
              </button>
              {expanded === key && <><DividendOneYearCandleChart symbol={item.symbol} /><div className="tce-card-actions mt-3"><span className="text-xs">Entry {formatEntry(pool?.entryLow ?? pool?.entry_low, pool?.entryHigh ?? pool?.entry_high)}</span><span className="text-xs">TP {formatNumber(pool?.targetPrice ?? pool?.target_price)}</span><button type="button" onClick={() => actions.openTrade({ ...pool, symbol: item.symbol, currentPrice: price, side: 'BUY' })}>BUY</button></div></>}
            </article>;
          })}</div>
        </section>) : <EmptyState text={`No dividend events scheduled for ${dividendMonthLabel(selectedMonth)}`} />}
      </div>}
      {tab === 'history' && <EmptyState text="Position history is ready for the next history feed." />}
    </div>
  );
}

function currentMonthKey(): string { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; }
function futureMonthKeys(): string[] { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); return Array.from({ length: 13 }, (_, index) => { const month = new Date(start.getFullYear(), start.getMonth() + index, 1); return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`; }); }
function buildFutureMonthGroups(events: StockEvent[]): MonthGroup[] { const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const months = Array.from({ length: 13 }, (_, index) => new Date(start.getFullYear(), start.getMonth() + index, 1)); const monthKeys = new Set(months.map(month => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`)); const grouped = new Map<string, Map<string, StockEvent[]>>(); for (const event of events) { const date = dividendEventDate(event); const symbol = String(event.ticker ?? '').trim().toUpperCase(); if (!date || !symbol || date.getTime() < today) continue; const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; if (!monthKeys.has(monthKey)) continue; const bucket = grouped.get(monthKey) ?? new Map<string, StockEvent[]>(); bucket.set(symbol, [...(bucket.get(symbol) ?? []), event]); grouped.set(monthKey, bucket); } return months.map(month => { const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`; const bucket = grouped.get(monthKey) ?? new Map<string, StockEvent[]>(); const cards = [...bucket.entries()].map(([symbol, tickerEvents]) => ({ symbol, events: tickerEvents.sort((a, b) => (dividendEventDate(a)?.getTime() ?? 0) - (dividendEventDate(b)?.getTime() ?? 0)) })).sort((a, b) => (dividendEventDate(a.events[0])?.getTime() ?? 0) - (dividendEventDate(b.events[0])?.getTime() ?? 0)); return { monthKey, cards }; }).filter(group => group.cards.length > 0); }
function dividendEventDate(event: StockEvent): Date | null { const raw = event.exDividendTimestamp ?? event.exDividendDate ?? event.exDate; if (!raw) return null; const value = String(raw).trim(); const parsed = new Date(value); if (!Number.isNaN(parsed.getTime())) return parsed; const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if (!match) return null; const [, day, month, year] = match; const fallback = new Date(Number(year), Number(month) - 1, Number(day)); return Number.isNaN(fallback.getTime()) ? null : fallback; }
function dividendMonthLabel(monthKey: string): string { const [year, month] = monthKey.split('-').map(Number); return `${String(month).padStart(2, '0')}/${year}`; }
function formatNumber(value: unknown): string { const n = Number(value); return Number.isFinite(n) && n > 0 ? n.toLocaleString('vi-VN') : '—'; }
function formatPercent(value: unknown): string { const n = Number(value); return Number.isFinite(n) ? `${n.toFixed(2)}%` : '—'; }
function formatRange(low: unknown, high: unknown): string { const l = Number(low); const h = Number(high); if (!Number.isFinite(l) || !Number.isFinite(h) || l <= 0 || h <= 0) return '—'; return `${l.toLocaleString('vi-VN')} – ${h.toLocaleString('vi-VN')}`; }
function money(value: number): string { return value.toLocaleString('vi-VN'); }
function formatDate(value: unknown): string { if (!value) return '—'; const date = new Date(String(value)); if (Number.isNaN(date.getTime())) return String(value); return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
function formatEntry(low: unknown, high: unknown): string { const l = Number(low); const h = Number(high); if (l > 0 && h > 0) return `${formatNumber(l)} – ${formatNumber(h)}`; if (l > 0) return formatNumber(l); if (h > 0) return formatNumber(h); return '—'; }
function EmptyState({ text }: { text: string }) { return <div className="tce-empty-state">{text}</div>; }
