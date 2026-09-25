'use client';

import { CalendarDays, ChevronDown, Percent, SlidersHorizontal, Tag, X } from 'lucide-react';
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useDashboardStore } from '../../lib/store';
import {
  usePositionFilterStore,
  DEFAULT_POSITION_PRICE_FILTER,
  type PositionDividendFilters,
} from '../../lib/position-filter-store';
import { useStockEventStore, type StockEvent } from '../../lib/stock-event-store';

const PRICE_OPTIONS = Array.from({ length: 9 }, (_, i) => (i + 1) * 10_000);

type Props = {
  className?: string;
};

export function DividendPositionsFilter({ className = '' }: Props) {
  const events = useStockEventStore(s => s.events);
  const marketPrices = useDashboardStore(s => s.marketPrices);
  const { selectedMonth, priceFilter, minYield, maxYield, setFilters } = usePositionFilterStore();
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PositionDividendFilters>({
    selectedMonth,
    priceFilter,
    minYield,
    maxYield,
  });

  useEffect(() => {
    const store = usePositionFilterStore.persist;
    try {
      const legacyRaw = window.localStorage.getItem('tce:positions:dividend-filters:v1');
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as Partial<PositionDividendFilters>;
        if (
          legacy.selectedMonth ||
          legacy.priceFilter ||
          legacy.minYield != null ||
          legacy.maxYield != null
        ) {
          usePositionFilterStore.setState(current => ({
            ...current,
            selectedMonth:
              typeof legacy.selectedMonth === 'string'
                ? legacy.selectedMonth
                : current.selectedMonth,
            priceFilter:
              Number.isFinite(Number(legacy.priceFilter)) && Number(legacy.priceFilter) > 0
                ? Number(legacy.priceFilter)
                : current.priceFilter,
            minYield: parseYieldFilter(legacy.minYield),
            maxYield: parseYieldFilter(legacy.maxYield),
          }));
        }
        window.localStorage.removeItem('tce:positions:dividend-filters:v1');
      }
    } catch {
      // Ignore invalid legacy filter state.
    }
    const onHydrate = () => setHydrated(false);
    const onFinish = () => {
      setHydrated(true);
      const next = usePositionFilterStore.getState();
      setDraft({
        selectedMonth: next.selectedMonth,
        priceFilter: next.priceFilter,
        minYield: next.minYield,
        maxYield: next.maxYield,
      });
    };
    const unsubHydrate = store.onHydrate(onHydrate);
    const unsubFinish = store.onFinishHydration(onFinish);
    void store.rehydrate();
    setHydrated(store.hasHydrated());
    return () => {
      unsubHydrate();
      unsubFinish();
    };
  }, []);

  const effective = hydrated
    ? { selectedMonth, priceFilter, minYield, maxYield }
    : usePositionFilterStore.getState();

  const monthGroups = useMemo(
    () =>
      buildFutureMonthGroups(events, {
        maxPrice: effective.priceFilter,
        minYield: effective.minYield,
        maxYield: effective.maxYield,
        marketPrices,
      }).filter(g => g.monthKey === effective.selectedMonth),
    [
      events,
      effective.selectedMonth,
      effective.priceFilter,
      effective.minYield,
      effective.maxYield,
      marketPrices,
    ]
  );
  const candidateCount = monthGroups.reduce((count, group) => count + group.cards.length, 0);
  const monthOptions = useMemo(() => futureMonthKeys(), []);

  const openFilters = () => {
    setDraft({ selectedMonth, priceFilter, minYield, maxYield });
    setOpen(true);
  };
  const applyFilters = () => {
    setFilters(draft);
    setOpen(false);
  };
  const resetDraft = () => {
    const next = {
      selectedMonth: currentMonthKey(),
      priceFilter: DEFAULT_POSITION_PRICE_FILTER,
      minYield: null,
      maxYield: null,
    };
    setDraft(next);
  };

  return (
    <>
      <div className={`tce-page-filter ${className}`} role="group" aria-label="Dividend filters">
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
              <b>Ex-date {dividendMonthLabel(effective.selectedMonth)}</b>
              <i>•</i>
              <b>Price ≤ {effective.priceFilter.toLocaleString('vi-VN')} ₫</b>
              <i>•</i>
              <b>
                Yield {effective.minYield ?? 0}–{effective.maxYield ?? '∞'}%
              </b>
            </span>
            <small>{candidateCount} candidates · tap to edit filters</small>
          </span>
          <ChevronDown className="size-4 tce-dividend-filter-chevron" aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div
          className="tce-filter-sheet-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="tce-filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dividend-filter-title"
            aria-describedby="dividend-filter-description"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="tce-filter-sheet-handle" aria-hidden="true" />
            <header className="tce-filter-sheet-header">
              <div className="min-w-0">
                <strong id="dividend-filter-title">Filter Dividend</strong>
                <span id="dividend-filter-description">
                  Choose the dividend month and screening rules
                </span>
              </div>
              <button
                type="button"
                className="tce-filter-sheet-close touch-target"
                onClick={() => setOpen(false)}
                aria-label="Close dividend filters"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </header>

            <div className="tce-filter-sheet-content">
              <div className="tce-filter-sheet-body">
                <div className="tce-filter-control">
                  <Label htmlFor="positions-filter-month">
                    <CalendarDays className="size-4" />
                    Ex-date month
                  </Label>
                  <Select
                    value={draft.selectedMonth}
                    onValueChange={value => setDraft(s => ({ ...s, selectedMonth: value }))}
                  >
                    <SelectTrigger id="positions-filter-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map(month => (
                        <SelectItem key={month} value={month}>
                          {dividendMonthLabel(month)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="tce-filter-control">
                  <Label>
                    <Tag className="size-4" />
                    Current price
                  </Label>
                  <div className="tce-filter-input-row">
                    <span className="tce-filter-prefix" aria-hidden="true">
                      ≤
                    </span>
                    <Select
                      value={String(draft.priceFilter)}
                      onValueChange={value => setDraft(s => ({ ...s, priceFilter: Number(value) }))}
                    >
                      <SelectTrigger aria-label="Maximum current price">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICE_OPTIONS.map(value => (
                          <SelectItem key={value} value={String(value)}>
                            {value.toLocaleString('vi-VN')} ₫
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="tce-filter-quick-row">
                    {[10_000, 20_000, 30_000, 50_000].map(value => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="tce-filter-quick-chip"
                        data-active={draft.priceFilter === value}
                        onClick={() => setDraft(s => ({ ...s, priceFilter: value }))}
                      >
                        ≤ {value / 1000}k
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="tce-filter-control">
                  <Label>
                    <Percent className="size-4" />
                    Dividend yield
                  </Label>
                  <div className="tce-filter-range-row">
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={draft.minYield ?? ''}
                      placeholder="Min %"
                      onChange={e =>
                        updateYield(setDraft, 'minYield', e.target.value, draft.maxYield)
                      }
                      aria-label="Minimum dividend yield"
                    />
                    <span>to</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={draft.maxYield ?? ''}
                      placeholder="Max %"
                      onChange={e =>
                        updateYield(setDraft, 'maxYield', e.target.value, draft.minYield)
                      }
                      aria-label="Maximum dividend yield"
                    />
                  </div>
                  <div className="tce-filter-quick-row">
                    {[
                      { label: '≥ 3%', min: 3, max: null },
                      { label: '≥ 5%', min: 5, max: null },
                      { label: '6–61%', min: 6, max: 61 },
                      { label: '≥ 10%', min: 10, max: null },
                    ].map(item => {
                      const active = draft.minYield === item.min && draft.maxYield === item.max;
                      return (
                        <Button
                          key={item.label}
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="tce-filter-quick-chip"
                          data-active={active}
                          onClick={() =>
                            setDraft(s => ({
                              ...s,
                              minYield: item.min,
                              maxYield: item.max,
                            }))
                          }
                        >
                          {item.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <footer className="tce-filter-sheet-footer">
                <Button
                  type="button"
                  variant="ghost"
                  className="tce-filter-reset"
                  disabled={
                    draft.selectedMonth === currentMonthKey() &&
                    draft.priceFilter === DEFAULT_POSITION_PRICE_FILTER &&
                    draft.minYield == null &&
                    draft.maxYield == null
                  }
                  onClick={resetDraft}
                >
                  Reset
                </Button>
                <Button type="button" className="tce-filter-apply" onClick={applyFilters}>
                  Apply
                </Button>
              </footer>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function updateYield(
  setDraft: Dispatch<SetStateAction<PositionDividendFilters>>,
  field: 'minYield' | 'maxYield',
  value: string,
  other: number | null
) {
  const next = parseYieldFilter(value);
  setDraft(current => {
    const state = { ...current, [field]: next };
    if (field === 'minYield' && next != null && other != null && next > other)
      state.maxYield = next;
    if (field === 'maxYield' && next != null && other != null && next < other)
      state.minYield = next;
    return state;
  });
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function futureMonthKeys() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return Array.from({ length: 13 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}
function dividendMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return `${String(month).padStart(2, '0')}/${year}`;
}
function parseYieldFilter(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
type MonthGroup = { monthKey: string; cards: Array<{ symbol: string; events: StockEvent[] }> };
function buildFutureMonthGroups(
  events: StockEvent[],
  filters: {
    maxPrice: number;
    minYield: number | null;
    maxYield: number | null;
    marketPrices: Record<string, { price?: number | null }>;
  }
): MonthGroup[] {
  const { maxPrice, minYield, maxYield, marketPrices } = filters;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const months = Array.from(
    { length: 13 },
    (_, index) => new Date(start.getFullYear(), start.getMonth() + index, 1)
  );
  const monthKeys = new Set(
    months.map(date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
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
    .filter(group => group.cards.length > 0);
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
