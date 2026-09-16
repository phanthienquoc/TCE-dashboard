'use client';
import { WalletCards, CircleDot, Tag, CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStockEventStore, type StockEvent } from '../../lib/stock-event-store';
import { useDashboardStore } from '../../lib/store';
import type { DashboardActions, DashboardData } from './DashboardShell';
import { DividendOneYearCandleChart } from './DividendOneYearCandleChart';
import TechLoading from '../navigation/TechLoading';

type ViewProps = { data: DashboardData; actions: DashboardActions };
type MonthGroup = { monthKey: string; cards: Array<{ symbol: string; events: StockEvent[] }> };
const PRICE_OPTIONS = Array.from({ length: 9 }, (_, i) => (i + 1) * 10_000);
const DEFAULT_PRICE_FILTER = 30_000;

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

  useEffect(() => {
    void load(2000, true, null);
  }, [load]);

  const monthGroups = useMemo(
    () =>
      buildFutureMonthGroups(events, priceFilter, marketPrices).filter(
        g => g.monthKey === selectedMonth
      ),
    [events, selectedMonth, priceFilter, marketPrices]
  );
  const monthOptions = useMemo(() => futureMonthKeys(), []);
  const symbolsKey = useMemo(
    () => monthGroups.flatMap(g => g.cards.map(c => c.symbol)).join(','),
    [monthGroups]
  );

  useEffect(() => {
    const symbols = [
      ...new Set(monthGroups.flatMap(g => g.cards.map(c => c.symbol))),
    ];
    if (!symbols.length) return;
    const snapshot = { pools: symbols.map(symbol => ({ symbol })) };
    void syncMarketPrices(snapshot);
    const timer = window.setInterval(
      () => void syncMarketPrices(snapshot),
      15 * 60 * 1000
    );
    return () => window.clearInterval(timer);
  }, [symbolsKey, syncMarketPrices]);

  return <div className="tce-mobile-view">
    <header className="tce-mobile-header"><div className="tce-header-brand"><WalletCards className="size-5" /><div><strong>Positions</strong><span>Live exposure</span></div></div><span className="tce-live-pill"><CircleDot className="size-3" /> LIVE</span></header>
    <div className="tce-segmented">{(['current', 'dividend', 'history'] as const).map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
    {tab === 'current' && <div className="tce-list-stack">{data.positions.length ? data.positions.map((row, i) => <article className="tce-dividend-card" key={row.id ?? row.symbol ?? i}><div className="flex items-center gap-2"><strong>{String(row.symbol ?? '—')}</strong><span className="tce-muted">Current position</span></div><div className="tce-pool-grid mt-2"><div><span>Entry</span><b>{formatNumber(row.positionPrice ?? row.position_price ?? row.avgBuyCost ?? row.avg_cost)}</b></div><div><span>Now</span><b>{formatNumber(row.marketPrice ?? row.market_price ?? row.currentPrice ?? row.current_price)}</b></div><div><span>P&L</span><b>{formatNumber(row.pnl ?? row.unrealizedPnl ?? row.unrealized_pnl)}</b></div></div><button className="tce-secondary-action mt-3" onClick={() => actions.openPositionSell(row)}>SELL</button></article>) : <EmptyState text="No current positions" />}</div>}
    {tab === 'dividend' && <div className="tce-list-stack tce-dividend-month-groups">
      <div className="tce-dividend-filter-bar" role="group" aria-label="Dividend filters">
        <label className="tce-dividend-filter-field" htmlFor="positions-dividend-month"><CalendarDays className="size-4" aria-hidden="true" /><span><small>Ex-date month</small><select id="positions-dividend-month" value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setExpanded(null); }} aria-label="Ex-date month">{monthOptions.map(m => <option key={m} value={m}>{dividendMonthLabel(m)}</option>)}</select></span></label>
        <div className="tce-dividend-filter-divider" aria-hidden="true" />
        <label className="tce-dividend-filter-field" htmlFor="positions-current-price"><Tag className="size-4" aria-hidden="true" /><span><small>Current price (VND)</small><select id="positions-current-price" value={priceFilter} onChange={e => { setPriceFilter(Number(e.target.value)); setExpanded(null); }} aria-label="Current price filter">{PRICE_OPTIONS.map(v => <option key={v} value={v}>≤ {v.toLocaleString('vi-VN')}</option>)}</select></span></label>
      </div>
      {loading ? <div className="min-h-[24rem]"><TechLoading label="Loading dividend events" /></div> : error ? <EmptyState text={error} /> : monthGroups.length ? monthGroups.map(group => <section className="tce-dividend-month-group" key={group.monthKey}><div className="tce-list-stack tce-dividend-month-cards">{group.cards.map(item => {
        const pool = data.pools.find(p => String(p.symbol ?? p.code ?? '').toUpperCase() === item.symbol);
        const event = item.events[0];
        const livePrice = marketPrices[item.symbol]?.price;
        const price = Number(livePrice) > 0 ? livePrice : event?.currentPrice ?? event?.price ?? pool?.currentPrice ?? pool?.current_price;
        const key = `${group.monthKey}:${item.symbol}`;
        return <article className="tce-dividend-card" key={key}><button type="button" className="w-full text-left" onClick={() => setExpanded(expanded === key ? null : key)} aria-expanded={expanded === key}><div className="flex items-center gap-2"><strong>{item.symbol}</strong>{event && <span className="tce-muted">{formatDate(event.exDividendTimestamp ?? event.exDividendDate ?? event.exDate)}</span>}<span className="ml-auto">{expanded === key ? '−' : '+'}</span></div><div className="tce-pool-grid mt-2"><div><span>Dividend</span><b>{Number(event?.dividendValue ?? 0) ? `${money(Number(event?.dividendValue))} ₫` : '—'}</b></div><div><span>Current Price</span><b>{formatNumber(price)}</b></div><div><span>Yield</span><b>{formatPercent(event?.dividendYieldPct)}</b></div><div><span>1Y Low</span><b>{formatNumber(event?.oneYearLow)}</b></div><div><span>1Y High</span><b>{formatNumber(event?.oneYearHigh)}</b></div><div><span>1Y Range</span><b>{formatRange(event?.oneYearLow, event?.oneYearHigh)}</b></div></div></button>{expanded === key && <><DividendOneYearCandleChart symbol={item.symbol} /><div className="tce-card-actions mt-3"><span className="text-xs">Entry {formatEntry(pool?.entryLow ?? pool?.entry_low, pool?.entryHigh ?? pool?.entry_high)}</span><span className="text-xs">TP {formatNumber(pool?.targetPrice ?? pool?.target_price)}</span><button type="button" onClick={() => actions.openTrade({ ...pool, symbol: item.symbol, currentPrice: price, side: 'BUY' })}>BUY</button></div></>}</article>;
      })}</div></section>) : <EmptyState text={`No dividend events scheduled for ${dividendMonthLabel(selectedMonth)} under ${priceFilter.toLocaleString('vi-VN')} VND`} />}
    </div>}
    {tab === 'history' && <EmptyState text="Position history is ready for the next history feed." />}
  </div>;
}
function currentMonthKey(): string { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; }
function futureMonthKeys(): string[] { const n = new Date(); const s = new Date(n.getFullYear(), n.getMonth(), 1); return Array.from({ length: 13 }, (_, i) => { const d = new Date(s.getFullYear(), s.getMonth() + i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }); }
function buildFutureMonthGroups(events: StockEvent[], maxPrice: number, marketPrices: Record<string, { price?: number | null }>): MonthGroup[] {
  const n = new Date(); const today = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); const s = new Date(n.getFullYear(), n.getMonth(), 1);
  const months = Array.from({ length: 13 }, (_, i) => new Date(s.getFullYear(), s.getMonth() + i, 1)); const monthKeys = new Set(months.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)); const grouped = new Map<string, Map<string, StockEvent[]>>();
  for (const event of events) { const date = dividendEventDate(event); const symbol = String(event.ticker ?? '').trim().toUpperCase(); if (!date || !symbol || date.getTime() < today) continue; const live = marketPrices[symbol]?.price; const price = Number(live) > 0 ? Number(live) : Number(event.currentPrice ?? event.price ?? 0); if (price <= 0 || price > maxPrice) continue; const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; if (!monthKeys.has(monthKey)) continue; const bucket = grouped.get(monthKey) ?? new Map<string, StockEvent[]>(); bucket.set(symbol, [...(bucket.get(symbol) ?? []), event]); grouped.set(monthKey, bucket); }
  return months.map(month => { const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`; const bucket = grouped.get(monthKey) ?? new Map<string, StockEvent[]>(); const cards = [...bucket.entries()].map(([symbol, tickerEvents]) => ({ symbol, events: tickerEvents.sort((a, b) => (dividendEventDate(b)?.getTime() ?? 0) - (dividendEventDate(a)?.getTime() ?? 0)) })).sort((a, b) => (dividendEventDate(b.events[0])?.getTime() ?? 0) - (dividendEventDate(a.events[0])?.getTime() ?? 0)); return { monthKey, cards }; }).filter(g => g.cards.length > 0);
}
function dividendEventDate(event: StockEvent): Date | null { const raw = event.exDividendTimestamp ?? event.exDividendDate ?? event.exDate; if (!raw) return null; const value = String(raw).trim(); const parsed = new Date(value); if (!Number.isNaN(parsed.getTime())) return parsed; const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if (!match) return null; const [, day, month, year] = match; const fallback = new Date(Number(year), Number(month) - 1, Number(day)); return Number.isNaN(fallback.getTime()) ? null : fallback; }
function dividendMonthLabel(key: string): string { const [year, month] = key.split('-').map(Number); return `${String(month).padStart(2, '0')}/${year}`; }
function formatNumber(value: unknown): string { const n = Number(value); return Number.isFinite(n) && n > 0 ? n.toLocaleString('vi-VN') : '—'; }
function formatPercent(value: unknown): string { const n = Number(value); return Number.isFinite(n) ? `${n.toFixed(2)}%` : '—'; }
function formatRange(low: unknown, high: unknown): string { const l = Number(low); const h = Number(high); if (!Number.isFinite(l) || !Number.isFinite(h) || l <= 0 || h <= 0) return '—'; return `${l.toLocaleString('vi-VN')} – ${h.toLocaleString('vi-VN')}`; }
function money(value: number): string { return value.toLocaleString('vi-VN'); }
function formatDate(value: unknown): string { if (!value) return '—'; const d = new Date(String(value)); if (Number.isNaN(d.getTime())) return String(value); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function formatEntry(low: unknown, high: unknown): string { const l = Number(low); const h = Number(high); if (l > 0 && h > 0) return `${formatNumber(l)} – ${formatNumber(h)}`; if (l > 0) return formatNumber(l); if (h > 0) return formatNumber(h); return '—'; }
function EmptyState({ text }: { text: string }) { return <div className="tce-empty-state">{text}</div>; }
