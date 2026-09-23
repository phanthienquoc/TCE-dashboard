'use client';
import {
  WalletCards,
  CircleDot,
  Tag,
  CalendarDays,
  Percent,
  SlidersHorizontal,
  X,
  ChevronDown,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStockEventStore, type StockEvent } from '../../lib/stock-event-store';
import { useDashboardStore } from '../../lib/store';
import type { DashboardActions, DashboardData } from './DashboardShell';
import { DividendOneYearCandleChart } from './DividendOneYearCandleChart';
import { DividendSkeleton } from '../ui/page-skeleton';

type ViewProps = { data: DashboardData; actions: DashboardActions };
type MonthGroup = { monthKey: string; cards: Array<{ symbol: string; events: StockEvent[] }> };
const PRICE_OPTIONS = Array.from({ length: 9 }, (_, i) => (i + 1) * 10_000);
const DEFAULT_PRICE_FILTER = 30_000;
const FILTER_STORAGE_KEY = 'tce:positions:dividend-filters:v1';
type DividendFilterPreferences = {
  selectedMonth?: string;
  priceFilter?: number;
  minYield?: number | null;
  maxYield?: number | null;
};

export function DividendPositionsView({ data, actions }: ViewProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [priceFilter, setPriceFilter] = useState(DEFAULT_PRICE_FILTER);
  const [minYield, setMinYield] = useState<number | null>(null);
  const [maxYield, setMaxYield] = useState<number | null>(null);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftMonth, setDraftMonth] = useState(selectedMonth);
  const [draftPriceFilter, setDraftPriceFilter] = useState(priceFilter);
  const [draftMinYield, setDraftMinYield] = useState<number | null>(minYield);
  const [draftMaxYield, setDraftMaxYield] = useState<number | null>(maxYield);
  const events = useStockEventStore(s => s.events);
  const loading = useStockEventStore(s => s.loading);
  const error = useStockEventStore(s => s.error);
  const load = useStockEventStore(s => s.load);
  const marketPrices = useDashboardStore(s => s.marketPrices);
  const syncMarketPrices = useDashboardStore(s => s.syncMarketPrices);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as DividendFilterPreferences;
        const months = futureMonthKeys();
        if (typeof saved.selectedMonth === 'string' && months.includes(saved.selectedMonth))
          setSelectedMonth(saved.selectedMonth);
        const savedPrice = Number(saved.priceFilter);
        if (Number.isFinite(savedPrice) && savedPrice > 0) setPriceFilter(savedPrice);
        setMinYield(parseYieldFilter(saved.minYield));
        setMaxYield(parseYieldFilter(saved.maxYield));
      }
    } catch {
      // Invalid or unavailable local preferences should not block the dividend view.
    } finally {
      setFiltersHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!filtersHydrated) return;
    try {
      window.localStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({ selectedMonth, priceFilter, minYield, maxYield })
      );
    } catch {
      // Ignore storage quota/privacy-mode errors; filters remain usable in memory.
    }
  }, [filtersHydrated, selectedMonth, priceFilter, minYield, maxYield]);

  useEffect(() => {
    void load(2000, true, null);
  }, [load]);

  const monthGroups = useMemo(
    () =>
      buildFutureMonthGroups(events, {
        maxPrice: priceFilter,
        minYield,
        maxYield,
        marketPrices,
      }).filter(g => g.monthKey === selectedMonth),
    [events, selectedMonth, priceFilter, minYield, maxYield, marketPrices]
  );
  const monthOptions = useMemo(() => futureMonthKeys(), []);

  const openFilters = () => {
    setDraftMonth(selectedMonth);
    setDraftPriceFilter(priceFilter);
    setDraftMinYield(minYield);
    setDraftMaxYield(maxYield);
    setFilterOpen(true);
  };
  const applyFilters = () => {
    setSelectedMonth(draftMonth);
    setPriceFilter(draftPriceFilter);
    setMinYield(draftMinYield);
    setMaxYield(draftMaxYield);
    setExpanded(null);
    setFilterOpen(false);
  };
  const resetFilters = () => {
    setDraftMonth(currentMonthKey());
    setDraftPriceFilter(DEFAULT_PRICE_FILTER);
    setDraftMinYield(null);
    setDraftMaxYield(null);
  };
  const symbolsKey = useMemo(
    () => monthGroups.flatMap(g => g.cards.map(c => c.symbol)).join(','),
    [monthGroups]
  );

  useEffect(() => {
    const symbols = [...new Set(monthGroups.flatMap(g => g.cards.map(c => c.symbol)))];
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
          <div>
            <strong>Positions</strong>
            <span>Live exposure</span>
          </div>
        </div>
        <span className="tce-live-pill">
          <CircleDot className="size-3" /> LIVE
        </span>
      </header>
      <div className="tce-positions-content">
        <div className="tce-dividend-filter-bar" role="group" aria-label="Dividend filters">
          <button
            type="button"
            className="tce-dividend-filter-summary"
            onClick={openFilters}
            aria-label="Open dividend filters"
          >
            <span className="tce-dividend-filter-summary-icon">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            </span>
            <span className="tce-dividend-filter-summary-copy">
              <span>
                <b>Ex-date {dividendMonthLabel(selectedMonth)}</b>
                <i>•</i>
                <b>Price ≤ {priceFilter.toLocaleString('vi-VN')} ₫</b>
                <i>•</i>
                <b>
                  Yield {minYield ?? 0}–{maxYield ?? '∞'}%
                </b>
              </span>
              <small>
                {monthGroups.reduce((count, group) => count + group.cards.length, 0)} candidates ·
                tap to edit filters
              </small>
            </span>
            <ChevronDown className="size-4 tce-dividend-filter-chevron" aria-hidden="true" />
          </button>
        </div>
        {filterOpen && (
          <div
            className="tce-filter-sheet-backdrop"
            role="presentation"
            onMouseDown={e => {
              if (e.currentTarget === e.target) setFilterOpen(false);
            }}
          >
            <section
              className="tce-filter-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dividend-filter-title"
            >
              <div className="tce-filter-sheet-handle" />
              <div className="tce-filter-sheet-header">
                <div>
                  <strong id="dividend-filter-title">Filter Dividend</strong>
                  <span>Choose the dividend month and screening rules</span>
                </div>
                <button
                  type="button"
                  className="tce-filter-sheet-close"
                  onClick={() => setFilterOpen(false)}
                  aria-label="Close filters"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="tce-filter-sheet-content">
                <div className="tce-filter-sheet-body">
                  <label className="tce-filter-control" htmlFor="positions-filter-month">
                    <span>
                      <CalendarDays className="size-4" />
                      Ex-date month
                    </span>
                    <select
                      id="positions-filter-month"
                      value={draftMonth}
                      onChange={e => setDraftMonth(e.target.value)}
                    >
                      {monthOptions.map(m => (
                        <option key={m} value={m}>
                          {dividendMonthLabel(m)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="tce-filter-control">
                    <span>
                      <Tag className="size-4" />
                      Current price
                    </span>
                    <div className="tce-filter-input-row">
                      <span className="tce-filter-prefix">≤</span>
                      <select
                        aria-label="Maximum current price"
                        value={draftPriceFilter}
                        onChange={e => setDraftPriceFilter(Number(e.target.value))}
                      >
                        {PRICE_OPTIONS.map(v => (
                          <option key={v} value={v}>
                            {v.toLocaleString('vi-VN')} ₫
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tce-filter-quick-row">
                      {[10000, 20000, 30000, 50000].map(v => (
                        <button
                          key={v}
                          type="button"
                          className={draftPriceFilter === v ? 'active' : ''}
                          onClick={() => setDraftPriceFilter(v)}
                        >
                          ≤ {v / 1000}k
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="tce-filter-control">
                    <span>
                      <Percent className="size-4" />
                      Dividend yield
                    </span>
                    <div className="tce-filter-range-row">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        inputMode="decimal"
                        value={draftMinYield ?? ''}
                        placeholder="Min"
                        onChange={e => {
                          const next = parseYieldFilter(e.target.value);
                          setDraftMinYield(next);
                          if (next != null && draftMaxYield != null && next > draftMaxYield)
                            setDraftMaxYield(next);
                        }}
                        aria-label="Minimum dividend yield"
                      />
                      <span>to</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        inputMode="decimal"
                        value={draftMaxYield ?? ''}
                        placeholder="Max"
                        onChange={e => {
                          const next = parseYieldFilter(e.target.value);
                          setDraftMaxYield(next);
                          if (next != null && draftMinYield != null && next < draftMinYield)
                            setDraftMinYield(next);
                        }}
                        aria-label="Maximum dividend yield"
                      />
                    </div>
                    <div className="tce-filter-quick-row">
                      {[
                        { label: '≥ 3%', min: 3, max: null },
                        { label: '≥ 5%', min: 5, max: null },
                        { label: '6–61%', min: 6, max: 61 },
                        { label: '≥ 10%', min: 10, max: null },
                      ].map(item => (
                        <button
                          key={item.label}
                          type="button"
                          className={
                            draftMinYield === item.min && draftMaxYield === item.max ? 'active' : ''
                          }
                          onClick={() => {
                            setDraftMinYield(item.min);
                            setDraftMaxYield(item.max);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="tce-filter-sheet-footer">
                <button type="button" className="tce-filter-reset" onClick={resetFilters}>
                  Reset
                </button>
                <button type="button" className="tce-filter-apply" onClick={applyFilters}>
                  Apply
                </button>
              </div>
            </section>
          </div>
        )}
        <div className="tce-positions-list">
          {loading ? (
            <DividendSkeleton />
          ) : error ? (
            <EmptyState text={error} />
          ) : monthGroups.length ? (
            monthGroups.map(group => (
              <section className="tce-dividend-month-group" key={group.monthKey}>
                <div className="tce-list-stack tce-dividend-month-cards">
                  {group.cards.map(item => {
                    const pool = data.pools.find(
                      p => String(p.symbol ?? p.code ?? '').toUpperCase() === item.symbol
                    );
                    const event = item.events[0];
                    const livePrice = marketPrices[item.symbol]?.price;
                    const price =
                      Number(livePrice) > 0
                        ? livePrice
                        : (event?.currentPrice ??
                          event?.price ??
                          pool?.currentPrice ??
                          pool?.current_price);
                    const key = `${group.monthKey}:${item.symbol}`;
                    return (
                      <article className="tce-dividend-card" key={key}>
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => setExpanded(expanded === key ? null : key)}
                          aria-expanded={expanded === key}
                        >
                          <div className="flex items-center gap-2">
                            <strong>{item.symbol}</strong>
                            {event && (
                              <span className="tce-muted">
                                {formatDate(
                                  event.exDividendTimestamp ?? event.exDividendDate ?? event.exDate
                                )}
                              </span>
                            )}
                            <span className="ml-auto">{expanded === key ? '−' : '+'}</span>
                          </div>
                          <div className="tce-pool-grid mt-2">
                            <div>
                              <span>Dividend</span>
                              <b>
                                {Number(event?.dividendValue ?? 0)
                                  ? `${money(Number(event?.dividendValue))} ₫`
                                  : '—'}
                              </b>
                            </div>
                            <div>
                              <span>Current Price</span>
                              <b>{formatNumber(price)}</b>
                            </div>
                            <div>
                              <span>Yield</span>
                              <b>{formatPercent(event?.dividendYieldPct)}</b>
                            </div>
                            <div>
                              <span>1Y Low</span>
                              <b>{formatNumber(event?.oneYearLow)}</b>
                            </div>
                            <div>
                              <span>1Y High</span>
                              <b>{formatNumber(event?.oneYearHigh)}</b>
                            </div>
                            <div>
                              <span>1Y Range</span>
                              <b>{formatRange(event?.oneYearLow, event?.oneYearHigh)}</b>
                            </div>
                          </div>
                        </button>
                        {expanded === key && (
                          <>
                            <DividendOneYearCandleChart symbol={item.symbol} />
                            <div className="tce-card-actions mt-3">
                              <span className="text-xs">
                                Entry{' '}
                                {formatEntry(
                                  pool?.entryLow ?? pool?.entry_low,
                                  pool?.entryHigh ?? pool?.entry_high
                                )}
                              </span>
                              <span className="text-xs">
                                TP {formatNumber(pool?.targetPrice ?? pool?.target_price)}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  actions.openTrade({
                                    ...pool,
                                    symbol: item.symbol,
                                    currentPrice: price,
                                    side: 'BUY',
                                  })
                                }
                              >
                                BUY
                              </button>
                            </div>
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <EmptyState
              text={`No dividend events scheduled for ${dividendMonthLabel(selectedMonth)} with the current filters`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
function currentMonthKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}
function futureMonthKeys(): string[] {
  const n = new Date();
  const s = new Date(n.getFullYear(), n.getMonth(), 1);
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(s.getFullYear(), s.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}
type DividendFilterOptions = {
  maxPrice: number;
  minYield: number | null;
  maxYield: number | null;
  marketPrices: Record<string, { price?: number | null }>;
};

function buildFutureMonthGroups(
  events: StockEvent[],
  filters: DividendFilterOptions
): MonthGroup[] {
  const { maxPrice, minYield, maxYield, marketPrices } = filters;
  const n = new Date();
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const s = new Date(n.getFullYear(), n.getMonth(), 1);
  const months = Array.from(
    { length: 13 },
    (_, i) => new Date(s.getFullYear(), s.getMonth() + i, 1)
  );
  const monthKeys = new Set(
    months.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  );
  const grouped = new Map<string, Map<string, StockEvent[]>>();

  for (const event of events) {
    const date = dividendEventDate(event);
    const symbol = String(event.ticker ?? '')
      .trim()
      .toUpperCase();
    if (!date || !symbol || date.getTime() < today) continue;

    const live = marketPrices[symbol]?.price;
    const price = Number(live) > 0 ? Number(live) : Number(event.currentPrice ?? event.price ?? 0);
    if (price <= 0 || price > maxPrice) continue;

    // Yield is part of the event being rendered, so apply the same value used by the card.
    // Keep missing/invalid yields out when a yield filter is explicitly active.
    const yieldPct = Number(event.dividendYieldPct);
    if (minYield != null || maxYield != null) {
      if (!Number.isFinite(yieldPct)) continue;
      if (minYield != null && yieldPct < minYield) continue;
      if (maxYield != null && yieldPct > maxYield) continue;
    }

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthKeys.has(monthKey)) continue;
    const bucket = grouped.get(monthKey) ?? new Map<string, StockEvent[]>();
    bucket.set(symbol, [...(bucket.get(symbol) ?? []), event]);
    grouped.set(monthKey, bucket);
  }

  return months
    .map(month => {
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      const bucket = grouped.get(monthKey) ?? new Map<string, StockEvent[]>();
      const cards = [...bucket.entries()]
        .map(([symbol, tickerEvents]) => ({
          symbol,
          events: tickerEvents.sort(
            (a, b) =>
              (dividendEventDate(b)?.getTime() ?? 0) - (dividendEventDate(a)?.getTime() ?? 0)
          ),
        }))
        .sort(
          (a, b) =>
            (dividendEventDate(b.events[0])?.getTime() ?? 0) -
            (dividendEventDate(a.events[0])?.getTime() ?? 0)
        );
      return { monthKey, cards };
    })
    .filter(g => g.cards.length > 0);
}

function parseYieldFilter(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function dividendEventDate(event: StockEvent): Date | null {
  const raw = event.exDividendTimestamp ?? event.exDividendDate ?? event.exDate;
  if (!raw) return null;
  const value = String(raw).trim();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const match = value.match(/^(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const fallback = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}
function dividendMonthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${String(month).padStart(2, '0')}/${year}`;
}
function formatNumber(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString('vi-VN') : '—';
}
function formatPercent(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : '—';
}
function formatRange(low: unknown, high: unknown): string {
  const l = Number(low);
  const h = Number(high);
  if (!Number.isFinite(l) || !Number.isFinite(h) || l <= 0 || h <= 0) return '—';
  return `${l.toLocaleString('vi-VN')} – ${h.toLocaleString('vi-VN')}`;
}
function money(value: number): string {
  return value.toLocaleString('vi-VN');
}
function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function formatEntry(low: unknown, high: unknown): string {
  const l = Number(low);
  const h = Number(high);
  if (l > 0 && h > 0) return `${formatNumber(l)} – ${formatNumber(h)}`;
  if (l > 0) return formatNumber(l);
  if (h > 0) return formatNumber(h);
  return '—';
}
function EmptyState({ text }: { text: string }) {
  return <div className="tce-empty-state">{text}</div>;
}
