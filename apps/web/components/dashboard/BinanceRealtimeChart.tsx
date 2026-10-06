'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from 'lightweight-charts';

type Props = {
  symbol?: string;
  interval?: string;
  limit?: number;
};

type BinanceKlineMessage = {
  e: 'kline';
  E: number;
  s: string;
  k: {
    t: number;
    T: number;
    s: string;
    i: string;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    x: boolean;
  };
};

type ChartCandle = CandlestickData<UTCTimestamp>;

const DEFAULT_SYMBOL = 'BTCUSDT';
const DEFAULT_INTERVAL = '1m';
const DEFAULT_LIMIT = 240;

export function BinanceRealtimeChart({
  symbol = DEFAULT_SYMBOL,
  interval = DEFAULT_INTERVAL,
  limit = DEFAULT_LIMIT,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const candlesRef = useRef<ChartCandle[]>([]);
  const [connected, setConnected] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalized = useMemo(() => symbol.trim().toLowerCase(), [symbol]);

  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.08)' },
        horzLines: { color: 'rgba(148,163,184,0.08)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148,163,184,0.15)',
      },
      timeScale: {
        borderColor: 'rgba(148,163,184,0.15)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(148,163,184,0.35)' },
        horzLine: { color: 'rgba(148,163,184,0.35)' },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#34d399',
      downColor: '#fb7185',
      borderVisible: false,
      wickUpColor: '#34d399',
      wickDownColor: '#fb7185',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const loadHistory = async () => {
      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${normalized.toUpperCase()}&interval=${encodeURIComponent(interval)}&limit=${Math.min(Math.max(limit, 50), 1000)}`,
          { cache: 'no-store' }
        );
        if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
        const rows = (await response.json()) as string[][];
        if (disposed) return;
        const candles = rows.map(row => ({
          time: Math.floor(Number(row[0]) / 1000) as UTCTimestamp,
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
        }));
        candlesRef.current = candles;
        series.setData(candles);
        chart.timeScale().fitContent();
        const last = candles.at(-1);
        if (last) setPrice(last.close);
      } catch (cause) {
        if (!disposed)
          setError(cause instanceof Error ? cause.message : 'Unable to load Binance history');
      }
    };

    const connect = () => {
      setError(null);
      const socket = new WebSocket(
        `wss://stream.binance.com:9443/ws/${normalized}@kline_${interval}`
      );
      socketRef.current = socket;

      socket.onopen = () => {
        if (!disposed) setConnected(true);
      };

      socket.onmessage = event => {
        if (disposed) return;
        try {
          const message = JSON.parse(event.data) as BinanceKlineMessage;
          if (message.e !== 'kline') return;
          const kline = message.k;
          const candle: ChartCandle = {
            time: Math.floor(kline.t / 1000) as UTCTimestamp,
            open: Number(kline.o),
            high: Number(kline.h),
            low: Number(kline.l),
            close: Number(kline.c),
          };
          setPrice(candle.close);
          const candles = candlesRef.current;
          const last = candles.at(-1);
          if (last && last.time === candle.time) {
            candles[candles.length - 1] = candle;
          } else {
            candles.push(candle);
            if (candles.length > Math.min(Math.max(limit, 50), 1000)) candles.shift();
          }
          series.update(candle);
        } catch {
          // Ignore malformed frames from the public stream.
        }
      };

      socket.onerror = () => {
        if (!disposed) setError('Binance WebSocket error');
      };

      socket.onclose = () => {
        if (!disposed) {
          setConnected(false);
          window.setTimeout(connect, 1500);
        }
      };
    };

    void loadHistory();
    connect();

    return () => {
      disposed = true;
      socketRef.current?.close(1000, 'unmount');
      socketRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [interval, limit, normalized]);

  return (
    <section className="tce-section">
      <div className="tce-section-title">
        <div>
          <h2>BTC/USDT</h2>
          <span className="tce-label">Binance · {interval}</span>
        </div>
        <span className={connected ? 'tce-live-pill' : 'tce-label'}>
          {connected ? 'LIVE' : 'CONNECTING'}
        </span>
      </div>
      <div className="tce-status-card">
        <div className="tce-section-row">
          <div>
            <span className="tce-label">LAST PRICE</span>
            <strong>
              {price == null ? '—' : price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </strong>
          </div>
          <span className="tce-label">SOURCE: BINANCE WS</span>
        </div>
        {error ? <div className="error-banner">{error}</div> : null}
        <div ref={containerRef} className="h-[360px] w-full" />
      </div>
    </section>
  );
}
