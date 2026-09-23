'use client';

import { CalendarDays, ChevronDown, Percent, SlidersHorizontal, Tag } from 'lucide-react';
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby="dividend-filter-description">
          <DialogHeader className="pr-12">
            <div>
              <DialogTitle>Filter Dividend</DialogTitle>
              <DialogDescription id="dividend-filter-description">
                Choose the dividend month and screening rules
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <div className="grid gap-2.5">
              <div className="grid gap-2 rounded-[13px] border border-border bg-surface/40 p-3">
                <Label htmlFor="positions-filter-month">
                  <CalendarDays className="size-4 text-primary" />
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

              <div className="grid gap-2 rounded-[13px] border border-border bg-surface/40 p-3">
                <Label>
                  <Tag className="size-4 text-primary" />
                  Current price
                </Label>
                <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-1.5">
                  <span className="grid min-h-11 place-items-center rounded-xl border border-border bg-surface-strong text-sm font-extrabold text-muted">
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
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                  {[10_000, 20_000, 30_000, 50_000].map(value => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={draft.priceFilter === value ? 'outline' : 'ghost'}
                      className={
                        draft.priceFilter === value
                          ? 'shrink-0 border-primary/40 bg-primary/10 text-primary'
                          : 'shrink-0 border border-border'
                      }
                      onClick={() => setDraft(s => ({ ...s, priceFilter: value }))}
                    >
                      ≤ {value / 1000}k
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 rounded-[13px] border border-border bg-surface/40 p-3">
                <Label>
                  <Percent className="size-4 text-primary" />
                  Dividend yield
                </Label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.minYield ?? ''}
                    placeholder="Min"
                    onChange={e =>
                      updateYield(setDraft, 'minYield', e.target.value, draft.maxYield)
                    }
                    aria-label="Minimum dividend yield"
                  />
                  <span className="text-[9px] text-muted">to</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.maxYield ?? ''}
                    placeholder="Max"
                    onChange={e =>
                      updateYield(setDraft, 'maxYield', e.target.value, draft.minYield)
                    }
                    aria-label="Maximum dividend yield"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                  {[
                    { label: '≥ 3%', min: 3, max: null },
                    { label: '≥ 5%', min: 5, max: null },
                    { label: '6–61%', min: 6, max: 61 },
                    { label: '≥ 10%', min: 10, max: null },
                  ].map(item => (
                    <Button
                      key={item.label}
                      type="button"
                      size="sm"
                      variant={
                        draft.minYield === item.min && draft.maxYield === item.max
                          ? 'outline'
                          : 'ghost'
                      }
                      className="shrink-0 border border-border"
                      onClick={() =>
                        setDraft(s => ({ ...s, minYield: item.min, maxYield: item.max }))
                      }
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetDraft}>
              Reset
            </Button>
            <Button type="button" onClick={applyFilters}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
