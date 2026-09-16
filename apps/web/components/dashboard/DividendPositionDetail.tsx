'use client';

import { ArrowLeft, ChevronLeft, WalletCards } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardActions, DashboardData } from './DashboardShell';
import { DividendOneYearCandleChart } from './DividendOneYearCandleChart';
import { useStockEventStore } from '../../lib/stock-event-store';
import { useDashboardStore } from '../../lib/store';

type Props = { symbol: string; data: DashboardData; actions: DashboardActions };

export function DividendPositionDetail({ symbol, data, actions }: Props) {
  const router = useRouter();
  const normalized = symbol.trim().toUpperCase();
  const events = useStockEventStore(state => state.events);
  const loading = useStockEventStore(state => state.loading);
  const error = useStockEventStore(state => state.error);
  const load = useStockEventStore(state => state.load);
  const marketPrices = useDashboardStore(state => state.marketPrices);
  const syncMarketPrices = useDashboardStore(state => state.syncMarketPrices);

  useEffect(() => {
    void load(500, true, null);
  }, [load]);

  const event = useMemo(() => {
    const matching = events
      .filter(item => String(item.ticker ?? '').trim().toUpperCase() === normalized)
      .filter(item => {
        const raw = item.exDividendTimestamp ?? item.exDividendDate ?? item.exDate;
        const date = raw ? new Date(String(raw)) : null;
        return date && !Number.isNaN(date.getTime());
      });
    return matching[0] ?? null;
  }, [events, normalized]);

  const pool = useMemo(
    () => data.pools.find(item => String(item.symbol ?? item.code ?? '').toUpperCase() === normalized),
    [data.pools, normalized]
  );

  useEffect(() => {
    void syncMarketPrices({ pools: [{ symbol: normalized }] });
  }, [normalized, syncMarketPrices]);

  const marketPrice = marketPrices[normalized]?.price;
  const price = Number(marketPrice) > 0 ? marketPrice : event?.currentPrice ?? event?.price ?? pool?.currentPrice ?? pool?.current_price;

  return (
    <div className="tce-mobile-view">
      <header className="tce-mobile-header">
        <div className="tce-header-brand">
          <button type="button" className="icon-button" onClick={() => router.back()} aria-label="Back">
            <ChevronLeft className="size-4" />
          </button>
          <div>
            <strong>{normalized}</strong>
            <span>Position detail</span>
          </div>
        </div>
      </header>

      <div className="tce-list-stack">
        <article className="tce-dividend-card">
          <div className="flex items-center gap-2">
            <WalletCards className="size-5" />
            <strong>{normalized}</strong>
          </div>
          <div className="tce-pool-grid mt-3">
            <div><span>Dividend</span><b>{Number(event?.dividendValue ?? 0) > 0 ? `${Number(event?.dividendValue).toLocaleString('vi-VN')} ₫` : '—'}</b></div>
            <div><span>Current Price</span><b>{formatNumber(price)}</b></div>
            <div><span>Yield</span><b>{formatPercent(event?.dividendYieldPct)}</b></div>
            <div><span>1Y Low</span><b>{formatNumber(event?.oneYearLow)}</b></div>
            <div><span>1Y High</span><b>{formatNumber(event?.oneYearHigh)}</b></div>
            <div><span>Ex-date</span><b>{formatDate(event?.exDividendTimestamp ?? event?.exDividendDate ?? event?.exDate)}</b></div>
          </div>
          <DividendOneYearCandleChart symbol={normalized} />
          <div className="tce-card-actions mt-3">
            <span className="text-xs">Entry {formatEntry(pool?.entryLow ?? pool?.entry_low, pool?.entryHigh ?? pool?.entry_high)}</span>
            <span className="text-xs">TP {formatNumber(pool?.targetPrice ?? pool?.target_price)}</span>
          </div>
          {pool && (
            <button
              type="button"
              className="tce-primary-action mt-3 w-full"
              onClick={() => actions.openTrade({ ...pool, symbol: normalized, currentPrice: price, side: 'BUY' })}
            >
              BUY {normalized}
            </button>
          )}
          {loading && <div className="tce-empty-state mt-3">Loading dividend event…</div>}
          {error && <div className="tce-empty-state mt-3">{error}</div>}
        </article>

        <button type="button" className="tce-secondary-action" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          Back to Positions
        </button>
      </div>
    </div>
  );
}

function formatNumber(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString('vi-VN') : '—';
}
function formatPercent(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : '—';
}
function formatDate(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}
function formatEntry(low: unknown, high: unknown): string {
  const l = Number(low);
  const h = Number(high);
  if (l > 0 && h > 0) return `${formatNumber(l)} – ${formatNumber(h)}`;
  if (l > 0) return formatNumber(l);
  if (h > 0) return formatNumber(h);
  return '—';
}
