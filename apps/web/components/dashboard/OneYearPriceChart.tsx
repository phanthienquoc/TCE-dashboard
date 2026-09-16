'use client';

import { useEffect, useMemo } from 'react';
import { usePriceHistoryStore } from '../../lib/price-history-store';

type Props = { symbol: string };

export function OneYearPriceChart({ symbol }: Props) {
  const normalized = symbol.trim().toUpperCase();
  const points = usePriceHistoryStore(state => state.histories[normalized] ?? []);
  const loading = usePriceHistoryStore(state => state.loading[normalized] ?? false);
  const error = usePriceHistoryStore(state => state.errors[normalized] ?? null);
  const load = usePriceHistoryStore(state => state.load);

  useEffect(() => {
    void load(normalized, 365);
  }, [load, normalized]);

  const chart = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map(point => point.price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, max * 0.01, 1);
    const width = 320;
    const height = 132;
    const left = 6;
    const right = 6;
    const top = 8;
    const bottom = 22;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const coordinates = points.map((point, index) => ({
      x: left + (index / (points.length - 1)) * plotWidth,
      y: top + ((max - point.price) / span) * plotHeight,
    }));
    return {
      min,
      max,
      coordinates,
      path: coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '),
    };
  }, [points]);

  if (loading && !points.length) {
    return <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-4 text-center text-[10px] text-slate-500">Loading 1Y price history…</div>;
  }
  if (error) {
    return <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-4 text-center text-[10px] text-slate-500">{error}</div>;
  }
  if (!chart) {
    return <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-4 text-center text-[10px] text-slate-500">No 1Y price history available</div>;
  }

  const firstDate = formatChartDate(points[0]?.date);
  const lastDate = formatChartDate(points[points.length - 1]?.date);
  const last = points[points.length - 1]?.price ?? 0;
  const changePct = points[0]?.price > 0 ? ((last - points[0].price) / points[0].price) * 100 : null;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.06] bg-black/10 px-3 pt-3 pb-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="block text-[8px] uppercase tracking-[0.08em] text-slate-500">1Y price</span>
          <span className="mt-0.5 block text-[10px] text-slate-400">{firstDate} – {lastDate}</span>
        </div>
        {changePct != null && <span className={changePct >= 0 ? 'text-[10px] font-bold text-emerald-400' : 'text-[10px] font-bold text-rose-400'}>{changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%</span>}
      </div>
      <svg viewBox="0 0 320 132" className="mt-2 h-[132px] w-full" role="img" aria-label={`${normalized} one year price chart`} preserveAspectRatio="none">
        <line x1="6" x2="314" y1="8" y2="8" stroke="currentColor" strokeOpacity="0.08" />
        <line x1="6" x2="314" y1="105" y2="105" stroke="currentColor" strokeOpacity="0.08" />
        <path d={chart.path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-400" />
      </svg>
      <div className="flex items-center justify-between text-[9px] text-slate-500">
        <span>Low {formatPrice(chart.min)}</span>
        <span>High {formatPrice(chart.max)}</span>
      </div>
    </div>
  );
}

function formatPrice(value: number) {
  return value.toLocaleString('vi-VN');
}

function formatChartDate(value: string | undefined) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}
