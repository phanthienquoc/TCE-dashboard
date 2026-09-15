'use client';

import { ChevronDown, WalletCards, CircleDot } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStockEventStore, type StockEvent } from '../../lib/stock-event-store';
import { useDashboardStore } from '../../lib/store';
import type { DashboardActions, DashboardData } from './DashboardShell';

type ViewProps = { data: DashboardData; actions: DashboardActions };
type MonthGroup = { monthKey: string; cards: Array<{ symbol: string; events: StockEvent[] }> };

export function DividendPositionsView({ data, actions }: ViewProps) {
  const [tab, setTab] = useState<'current' | 'dividend' | 'history'>('dividend');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const events = useStockEventStore(s => s.events);
  const loading = useStockEventStore(s => s.loading);
  const error = useStockEventStore(s => s.error);
  const load = useStockEventStore(s => s.load);
  const marketPrices = useDashboardStore(s => s.marketPrices);
  const syncMarketPrices = useDashboardStore(s => s.syncMarketPrices);

  useEffect(() => {
    void load(500, false, null);
  }, [load]);

  const monthGroups = useMemo(() => buildFutureMonthGroups(events), [events]);
  const symbolsKey = useMemo(
    () => monthGroups.flatMap(group => group.cards.map(card => card.symbol)).join(','),
    [monthGroups]
  );

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
        <div className="tce-header-brand">
          <WalletCards className="size-5" />
          <div><strong>Positions</strong><span>Live exposure</span></div>
        </div>
        <span className="tce-live-pill"><CircleDot className="size-3" /> LIVE</span>
      </header>

      <div className="tce-segmented">
        {(['current', 'dividend', 'history'] as const).map(item => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'current' && (
        <div className="tce-list-stack">
          {data.positions.length ? data.positions.map((row, index) => (
            <article className="tce-dividend-card" key={row.id ?? row.symbol ?? index}>
              <div className="flex items-center gap-2"><strong>{String(row.symbol ?? '—')}</strong><span className="tce-muted">Current position</span></div>
              <div className="tce-pool-grid mt-2">
                <div><span>Entry</span><b>{formatNumber(row.positionPrice ?? row.position_price ?? row.avgBuyCost ?? row.avg_cost)}</b></div>
                <div><span>Now</span><b>{formatNumber(row.marketPrice ?? row.market_price ?? row.currentPrice ?? row.current_price)}</b></div>
                <div><span>P&L</span><b>{formatNumber(row.pnl ?? row.unrealizedPnl ?? row.unrealized_pnl)}</b></div>
              </div>
              <button className="tce-secondary-action mt-3" onClick={() => actions.openPositionSell(row)}>SELL</button>
            </article>
          )) : <EmptyState text="No current positions" />}
        </div>
      )}

      {tab === 'dividend' && (
        <div className="tce-list-stack tce-dividend-month-groups">
          {loading ? <EmptyState text="Loading dividend events…" /> : error ? <EmptyState text={error} /> : (
            monthGroups.map(group => {
              const collapsed = collapsedMonths.has(group.monthKey);
              return (
                <section className="tce-dividend-month-group" key={group.monthKey}>
                  <button type="button" className="tce-dividend-month-header" aria-expanded={!collapsed}
                    onClick={() => setCollapsedMonths(current => {
                      const next = new Set(current);
                      if (next.has(group.monthKey)) next.delete(group.monthKey); else next.add(group.monthKey);
                      return next;
                    })}>
                    <span className="tce-dividend-month-title">{dividendMonthLabel(group.monthKey)}</span>
                    <span className="tce-dividend-month-count">{group.cards.length} {group.cards.length === 1 ? 'event' : 'events'}</span>
                    <ChevronDown className={`tce-dividend-month-chevron${collapsed ? '' : ' is-open'}`} aria-hidden="true" />
                  </button>
                  {!collapsed && (
                    <div className="tce-list-stack tce-dividend-month-cards">
                      {group.cards.length ? group.cards.map(item => {
                        const pool = data.pools.find(p => String(p.symbol ?? p.code ?? '').toUpperCase() === item.symbol);
                        const event = item.events[0];
                        const marketPrice = marketPrices[item.symbol]?.price;
                        const price = marketPrice ?? event?.price ?? pool?.currentPrice ?? pool?.current_price;
                        const key = `${group.monthKey}:${item.symbol}`;
                        return (
                          <article className="tce-dividend-card" key={key}>
                            <button type="button" className="w-full text-left" onClick={() => setExpanded(expanded === key ? null : key)} aria-expanded={expanded === key}>
                              <div className="flex items-center gap-2"><strong>{item.symbol}</strong>{event && <span className="tce-muted">{formatDate(event.exDividendTimestamp ?? event.exDividendDate ?? event.exDate)}</span>}<span className="ml-auto">{expanded === key ? '−' : '+'}</span></div>
                              <div className="tce-pool-grid mt-2">
                                <div><span>Dividend</span><b>{Number(event?.dividendValue ?? 0) ? `${money(Number(event?.dividendValue))} ₫` : '—'}</b></div>
                                <div><span>Price</span><b>{formatNumber(price)}</b></div>
                                <div><span>TP</span><b>{formatNumber(pool?.targetPrice ?? pool?.target_price)}</b></div>
                              </div>
                            </button>
                            {expanded === key && <div className="tce-card-actions mt-3"><span className="text-xs">Entry {formatEntry(pool?.entryLow ?? pool?.entry_low, pool?.entryHigh ?? pool?.entry_high)}</span><button type="button" onClick={() => actions.openTrade({ ...pool, symbol: item.symbol, currentPrice: price, side: 'BUY' })}>BUY</button></div>}
                          </article>
                        );
                      }) : <EmptyState text="No dividend events scheduled" />}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      )}

      {tab === 'history' && <EmptyState text="Position history is ready for the next history feed." />}
    </div>
  );
}

function buildFutureMonthGroups(events: StockEvent[]): MonthGroup[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const months = Array.from({ length: 13 }, (_, index) => new Date(start.getFullYear(), start.getMonth() + index, 1));
  const grouped = new Map<string, Map<string, StockEvent[]>>();

  for (const event of events) {
    const date = dividendEventDate(event);
    const symbol = String(event.ticker ?? '').trim().toUpperCase();
    if (!date || !symbol) continue;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = grouped.get(monthKey) ?? new Map<string, StockEvent[]>();
    bucket.set(symbol, [...(bucket.get(symbol) ?? []), event]);
    grouped.set(monthKey, bucket);
  }

  return months.map(month => {
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const bucket = grouped.get(monthKey) ?? new Map<string, StockEvent[]>();
    return {
      monthKey,
      cards: [...bucket.entries()]
        .map(([symbol, tickerEvents]) => ({ symbol, events: tickerEvents.sort((a, b) => (dividendEventDate(b)?.getTime() ?? 0) - (dividendEventDate(a)?.getTime() ?? 0)) }))
        .sort((a, b) => (dividendEventDate(b.events[0])?.getTime() ?? 0) - (dividendEventDate(a.events[0])?.getTime() ?? 0)),
    };
  });
}

function dividendEventDate(event: StockEvent): Date | null {
  const raw = event.exDividendTimestamp ?? event.exDividendDate ?? event.exDate;
  if (!raw) return null;
  const value = String(raw).trim();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const fallback = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}
function dividendMonthLabel(monthKey: string): string { const [year, month] = monthKey.split('-').map(Number); return `${String(month).padStart(2, '0')}/${year}`; }
function formatNumber(value: unknown): string { const n = Number(value); return Number.isFinite(n) && n > 0 ? n.toLocaleString('vi-VN') : '—'; }
function money(value: number): string { return value.toLocaleString('vi-VN'); }
function formatDate(value: unknown): string { if (!value) return '—'; const date = new Date(String(value)); if (Number.isNaN(date.getTime())) return String(value); return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
function formatEntry(low: unknown, high: unknown): string { const l = Number(low); const h = Number(high); if (l > 0 && h > 0) return `${formatNumber(l)} – ${formatNumber(h)}`; if (l > 0) return formatNumber(l); if (h > 0) return formatNumber(h); return '—'; }
function EmptyState({ text }: { text: string }) { return <div className="tce-empty-state">{text}</div>; }
