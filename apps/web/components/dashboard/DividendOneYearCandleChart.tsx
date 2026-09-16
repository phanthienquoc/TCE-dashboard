'use client';

import { useEffect, useMemo } from 'react';
import { useDividendOhlcvStore } from '../../lib/dividend-ohlcv-store';

type Props = { symbol: string };

type Candle = { x: number; openY: number; closeY: number; highY: number; lowY: number; up: boolean };

export function DividendOneYearCandleChart({ symbol }: Props) {
  const normalized = symbol.trim().toUpperCase();
  const rows = useDividendOhlcvStore(state => state.histories[normalized] ?? []);
  const loading = useDividendOhlcvStore(state => state.loading[normalized] ?? false);
  const error = useDividendOhlcvStore(state => state.errors[normalized] ?? null);
  const load = useDividendOhlcvStore(state => state.load);

  useEffect(() => { void load(normalized, 365); }, [load, normalized]);

  const chart = useMemo(() => {
    const valid = rows.filter(row => [row.open, row.high, row.low, row.close].every(value => value != null && value > 0));
    if (valid.length < 2) return null;
    const min = Math.min(...valid.map(row => row.low!));
    const max = Math.max(...valid.map(row => row.high!));
    const span = Math.max(max - min, max * 0.01, 1);
    const width = 320;
    const height = 168;
    const top = 8;
    const bottom = 22;
    const left = 6;
    const right = 6;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const step = plotWidth / Math.max(valid.length - 1, 1);
    const y = (value: number) => top + ((max - value) / span) * plotHeight;
    return {
      valid,
      min,
      max,
      candles: valid.map((row, index) => ({
        x: left + index * step,
        openY: y(row.open!),
        closeY: y(row.close!),
        highY: y(row.high!),
        lowY: y(row.low!),
        up: row.close! >= row.open!,
      } as Candle)),
    };
  }, [rows]);

  if (loading && !rows.length) return <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-4 text-center text-[10px] text-slate-500">Loading 1Y candles…</div>;
  if (error) return <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-4 text-center text-[10px] text-slate-500">{error}</div>;
  if (!chart) return <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-4 text-center text-[10px] text-slate-500">No 1Y candle history available</div>;

  const firstDate = formatDate(chart.valid[0].tradingDate);
  const lastDate = formatDate(chart.valid.at(-1)?.tradingDate);
  const firstClose = chart.valid[0].close!;
  const lastClose = chart.valid.at(-1)?.close ?? firstClose;
  const changePct = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : null;
  const bodyWidth = Math.max(2, Math.min(8, (320 / chart.valid.length) * 0.55));

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.06] bg-black/10 px-3 pt-3 pb-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="block text-[8px] uppercase tracking-[0.08em] text-slate-500">1Y daily candles</span>
          <span className="mt-0.5 block text-[10px] text-slate-400">{firstDate} – {lastDate}</span>
        </div>
        {changePct != null && <span className={changePct >= 0 ? 'text-[10px] font-bold text-emerald-400' : 'text-[10px] font-bold text-rose-400'}>{changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%</span>}
      </div>
      <svg viewBox="0 0 320 168" className="mt-2 h-[168px] w-full" role="img" aria-label={`${normalized} one year daily candlestick chart`} preserveAspectRatio="none">
        <line x1="6" x2="314" y1="8" y2="8" stroke="currentColor" strokeOpacity="0.08" />
        <line x1="6" x2="314" y1="146" y2="146" stroke="currentColor" strokeOpacity="0.08" />
        {chart.candles.map((candle, index) => {
          const bodyTop = Math.min(candle.openY, candle.closeY);
          const bodyHeight = Math.max(Math.abs(candle.closeY - candle.openY), 1);
          return <g key={`${candle.x}-${index}`} className={candle.up ? 'text-emerald-400' : 'text-rose-400'}>
            <line x1={candle.x} x2={candle.x} y1={candle.highY} y2={candle.lowY} stroke="currentColor" strokeWidth="1" />
            <rect x={candle.x - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill="currentColor" fillOpacity="0.78" rx="0.7" />
          </g>;
        })}
      </svg>
      <div className="flex items-center justify-between text-[9px] text-slate-500">
        <span>Low {formatPrice(chart.min)}</span>
        <span>High {formatPrice(chart.max)}</span>
      </div>
    </div>
  );
}

function formatPrice(value: number) { return value.toLocaleString('vi-VN'); }
function formatDate(value: string | undefined) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}
