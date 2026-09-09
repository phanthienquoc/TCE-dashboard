'use client';

import {
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Layers3,
  Search,
  Settings2,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  Wifi,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import PlatformConfigTab from '../config/PlatformConfigTab';
import { useStockEventStore, type StockEvent } from '../../lib/stock-event-store';
import { useDashboardStore } from '../../lib/store';
import type { DashboardActions, DashboardData } from './DashboardShell';

type ViewProps = { data: DashboardData; actions: DashboardActions };

export function OverviewView({ data }: ViewProps) {
  const positions = data.positions.slice(0, 4);
  const pools = data.pools.slice(0, 3);
  const total = number(data.portfolioValue ?? Number(data.invested || 0) + Number(data.cash || 0));
  const invested = number(data.invested);
  const cash = number(data.cash);
  const pnl = sum(positions.map(row => row.unrealizedPnl ?? row.unrealized_pnl ?? row.pnl ?? 0));
  const pnlPct = invested ? (pnl / invested) * 100 : 0;

  return (
    <div className="tce-mobile-view">
      <MobileHeader
        title="TCE"
        subtitle="Trade · Cash · Extract"
        icon={<span className="tce-brand-mark">T</span>}
      />
      <section className="tce-greeting">
        <p>Good evening</p>
        <span>Keep discipline. Let TCE work for you.</span>
      </section>
      <section className="tce-hero-card">
        <div>
          <span className="tce-label">Total Portfolio</span>
          <strong>{money(total)}</strong>
          <span className={pnl >= 0 ? 'tce-positive' : 'tce-negative'}>
            {signedMoney(pnl)} ({signedPercent(pnlPct)})
          </span>
        </div>
        <MiniChart positive={pnl >= 0} />
      </section>
      <div className="tce-stat-grid">
        <Stat label="Cash" value={money(cash)} />
        <Stat label="Invested" value={money(invested)} />
        <Stat label="Positions" value={String(data.positions.length)} />
      </div>
      <section className="tce-status-card">
        <div className="tce-section-row">
          <div>
            <span className="tce-label">TCE MARKET</span>
            <strong>Scan complete</strong>
          </div>
          <span className="tce-time">{timeNow()}</span>
        </div>
        <div className="tce-status-dot">
          <CircleDot className="size-4" /> System ready
        </div>
        <div className="tce-market-metrics">
          <Metric value={data.pools.length + data.next.length} label="opportunities" />
          <Metric value={data.next.length} label="next setups" />
          <Metric value={data.positions.length} label="positions" />
        </div>
      </section>
      <MobileSection title="Current Positions" action="See all" href="/position">
        {positions.length ? (
          positions.map((row, index) => (
            <PositionRow key={row.id ?? row.symbol ?? index} row={row} />
          ))
        ) : (
          <EmptyState text="No current positions" />
        )}
      </MobileSection>
      <MobileSection title="Top Pools" action="See all" href="/pool">
        {pools.length ? (
          pools.map((row, index) => <PoolRow key={row.id ?? row.symbol ?? index} row={row} />)
        ) : (
          <EmptyState text="No shared pools" />
        )}
      </MobileSection>
    </div>
  );
}

export function PoolsView({ data, actions }: ViewProps) {
  return (
    <div className="tce-mobile-view">
      <MobileHeader
        title="Pools"
        subtitle="TCE opportunities"
        icon={<Layers3 className="size-5" />}
      />
      <div className="tce-filter-row">
        <button className="tce-filter active">All</button>
        <button className="tce-filter">Watchlist</button>
        <button className="tce-filter">High Conviction</button>
      </div>
      <div className="tce-list-stack">
        {data.pools.length ? (
          data.pools.map((row, index) => (
            <PoolCard
              key={row.id ?? row.symbol ?? index}
              row={row}
              onBuy={() => actions.openTrade(row)}
              onPromote={() => actions.promotePool(row)}
              busy={actions.promoteBusy === String(row.id)}
            />
          ))
        ) : (
          <EmptyState text="No shared pool items" />
        )}
      </div>
    </div>
  );
}

export function PositionsView({ data, actions }: ViewProps) {
  const [tab, setTab] = useState<'current' | 'dividend' | 'history'>('current');
  const events = useStockEventStore(s => s.events);
  const loading = useStockEventStore(s => s.loading);
  const error = useStockEventStore(s => s.error);
  const load = useStockEventStore(s => s.load);
  const marketPrices = useDashboardStore(s => s.marketPrices);
  const syncMarketPrices = useDashboardStore(s => s.syncMarketPrices);
  useEffect(() => {
    void load();
  }, [load]);
  const dividendPools = useMemo(() => {
    const grouped = new Map<string, StockEvent[]>();
    for (const event of events) {
      const ticker = String(event.ticker ?? '')
        .trim()
        .toUpperCase();
      if (!ticker) continue;
      grouped.set(ticker, [...(grouped.get(ticker) ?? []), event]);
    }
    return [...grouped.entries()]
      .map(([symbol, tickerEvents]) => ({ symbol, events: tickerEvents }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [events]);
  const dividendSymbolsKey = useMemo(() => dividendPools.map(item => item.symbol).join(','), [dividendPools]);
  useEffect(() => {
    const symbols = dividendPools.map(item => item.symbol);
    if (!symbols.length) return;
    const snapshot = { pools: symbols.map(symbol => ({ symbol })) };
    void syncMarketPrices(snapshot);
    const timer = window.setInterval(() => {
      void syncMarketPrices(snapshot);
    }, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [dividendSymbolsKey, syncMarketPrices]);
  return (
    <div className="tce-mobile-view">
      <MobileHeader
        title="Positions"
        subtitle="Live exposure"
        icon={<WalletCards className="size-5" />}
        live
      />
      <div className="tce-segmented">
        {(['current', 'dividend', 'history'] as const).map(item => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'current' && (
        <div className="tce-list-stack">
          {data.positions.length ? (
            data.positions.map((row, index) => (
              <PositionCard
                key={row.id ?? row.symbol ?? index}
                row={row}
                onSell={() => actions.openPositionSell(row)}
              />
            ))
          ) : (
            <EmptyState text="No current positions" />
          )}
        </div>
      )}
      {tab === 'dividend' && (
        <div className="tce-list-stack">
          {loading ? (
            <EmptyState text="Loading dividend events…" />
          ) : error ? (
            <EmptyState text={error} />
          ) : dividendPools.length ? (
            dividendPools.map(item => (
              <DividendCard
                key={item.symbol}
                item={item}
                pool={data.pools.find(
                  p => String(p.symbol ?? p.code ?? '').toUpperCase() === item.symbol
                )}
                marketPrice={marketPrices[item.symbol]?.price}
              />
            ))
          ) : (
            <EmptyState text="No upcoming dividend pools" />
          )}
        </div>
      )}
      {tab === 'history' && (
        <EmptyState text="Position history is ready for the next history feed." />
      )}
    </div>
  );
}

export function ScanView({ data }: ViewProps) {
  const opportunities = [...data.pools, ...data.next].slice(0, 8);
  return (
    <div className="tce-mobile-view">
      <MobileHeader
        title="Market Scan"
        subtitle="TCE framework"
        icon={<Search className="size-5" />}
        live
      />
      <section className="tce-scan-card">
        <div className="tce-section-row">
          <div>
            <span className="tce-label">MARKET SCAN</span>
            <strong>Scan complete</strong>
          </div>
          <span className="tce-positive">100%</span>
        </div>
        <div className="tce-progress">
          <span style={{ width: '100%' }} />
        </div>
        <small>Whole-market evaluation completed</small>
        <div className="tce-market-metrics">
          <Metric value={data.pools.length} label="bullish" />
          <Metric value={data.next.length} label="setups" />
          <Metric value={opportunities.length} label="high signal" />
        </div>
      </section>
      <MobileSection title="Top Opportunities" action="Pools" href="/pool">
        {opportunities.length ? (
          opportunities.map((row, index) => (
            <PoolRow key={row.id ?? row.symbol ?? index} row={row} />
          ))
        ) : (
          <EmptyState text="No opportunities yet" />
        )}
      </MobileSection>
    </div>
  );
}

export function OrdersView({ data }: ViewProps) {
  return (
    <div className="tce-mobile-view">
      <MobileHeader
        title="Orders"
        subtitle="Execution history"
        icon={<TrendingUp className="size-5" />}
      />
      {data.orders.length ? (
        <div className="tce-list-stack">
          {data.orders.slice(0, 20).map((row, index) => (
            <div className="tce-row-card" key={row.id ?? index}>
              <div>
                <strong>{String(row.symbol ?? row.code ?? 'Order')}</strong>
                <span>
                  {String(row.side ?? row.action ?? 'ORDER')} · {String(row.status ?? 'OPEN')}
                </span>
              </div>
              <b>{money(row.price ?? row.value)}</b>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="No recent orders" />
      )}
    </div>
  );
}

export function SettingsView() {
  return (
    <div className="tce-mobile-view">
      <MobileHeader title="More" subtitle="TCE system" icon={<Settings2 className="size-5" />} />
      <section className="tce-settings-card">
        <SettingRow icon={<ShieldCheck />} label="Backend" value="Online" ok />
        <SettingRow icon={<Wifi />} label="Price Sync" value="Realtime" ok />
        <SettingRow icon={<CheckCircle2 />} label="TCE Engine" value="Healthy" ok />
        <SettingRow icon={<Bell />} label="Push Notifications" value="Enabled" ok />
      </section>
      <section className="tce-settings-group">
        <div className="tce-settings-title">Account</div>
        <PlatformConfigTab />
      </section>
      <div className="tce-version">TCE Dashboard · Mobile PWA</div>
    </div>
  );
}

function MobileHeader({
  title,
  subtitle,
  icon,
  live,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  live?: boolean;
}) {
  return (
    <header className="tce-mobile-header">
      <div className="tce-header-brand">
        {icon}
        <div>
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
      </div>
      {live ? (
        <span className="tce-live-pill">
          <CircleDot className="size-3" /> LIVE
        </span>
      ) : (
        <Bell className="size-5 tce-muted" />
      )}
    </header>
  );
}
function MobileSection({
  title,
  action,
  href,
  children,
}: {
  title: string;
  action?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tce-section">
      <div className="tce-section-title">
        <h2>{title}</h2>
        {action && href ? (
          <a href={href}>
            {action}
            <ChevronRight className="size-4" />
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="tce-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
function PositionRow({ row }: { row: any }) {
  const pnl = Number(row.pnl ?? row.unrealizedPnl ?? row.unrealized_pnl ?? 0);
  return (
    <a className="tce-row-card" href="/position">
      <div>
        <strong>{symbolOf(row)}</strong>
        <span>{formatNumber(row.quantity ?? row.total ?? 0)} shares</span>
      </div>
      <div className="tce-row-price">
        <strong>
          {formatNumber(
            row.marketPrice ?? row.market_price ?? row.currentPrice ?? row.current_price
          )}
        </strong>
        <span className={pnl >= 0 ? 'tce-positive' : 'tce-negative'}>
          {pnl >= 0 ? '+' : ''}
          {formatNumber(pnl)}
        </span>
      </div>
    </a>
  );
}
function PoolRow({ row }: { row: any }) {
  const score = Number(row.score ?? 0);
  return (
    <a className="tce-row-card" href="/pool">
      <div>
        <strong>{symbolOf(row)}</strong>
        <span>{String(row.status ?? 'WATCHING')}</span>
      </div>
      <div className="tce-score">
        <strong>{Number.isFinite(score) && score ? score : '—'}</strong>
        <span>TCE Score</span>
      </div>
    </a>
  );
}
function PoolCard({
  row,
  onBuy,
  onPromote,
  busy,
}: {
  row: any;
  onBuy: () => void;
  onPromote: () => void;
  busy: boolean;
}) {
  const score = Number(row.score ?? 0);
  const price = row.currentPrice ?? row.current_price ?? row.marketPrice ?? row.market_price;
  return (
    <article className="tce-pool-card">
      <div className="tce-card-top">
        <div>
          <strong>{symbolOf(row)}</strong>
          <span>{String(row.name ?? 'TCE Pool')}</span>
        </div>
        <div className="tce-score">
          <strong>{Number.isFinite(score) && score ? score : '—'}</strong>
          <span>TCE Score</span>
        </div>
      </div>
      <div className="tce-price-line">
        <strong>{formatNumber(price)}</strong>
        <span className="tce-positive">{String(row.status ?? 'WATCHING')}</span>
      </div>
      <MiniChart positive />
      <div className="tce-pool-grid">
        <div>
          <span>Entry</span>
          <b>{formatEntry(row.entryLow ?? row.entry_low, row.entryHigh ?? row.entry_high)}</b>
        </div>
        <div>
          <span>TP</span>
          <b>{formatNumber(row.targetPrice ?? row.target_price)}</b>
        </div>
        <div>
          <span>R:R</span>
          <b>{String(row.rr ?? row.riskReward ?? row.risk_reward ?? '—')}</b>
        </div>
      </div>
      <div className="tce-card-actions">
        <button onClick={onBuy}>BUY</button>
        <button onClick={onPromote} disabled={busy}>
          {busy ? '…' : 'Promote'}
        </button>
      </div>
    </article>
  );
}
function PositionCard({ row, onSell }: { row: any; onSell: () => void }) {
  const pnl = Number(row.pnl ?? row.unrealizedPnl ?? row.unrealized_pnl ?? 0);
  return (
    <article className="tce-position-card">
      <div className="tce-card-top">
        <div>
          <strong>{symbolOf(row)}</strong>
          <span>{formatNumber(row.quantity ?? row.total ?? 0)} shares</span>
        </div>
        <span className="tce-live-dot">● LIVE</span>
      </div>
      <div className="tce-price-line">
        <strong>
          {formatNumber(
            row.marketPrice ?? row.market_price ?? row.currentPrice ?? row.current_price
          )}
        </strong>
        <span className={pnl >= 0 ? 'tce-positive' : 'tce-negative'}>
          {pnl >= 0 ? '+' : ''}
          {formatNumber(pnl)}
        </span>
      </div>
      <div className="tce-pool-grid">
        <div>
          <span>Entry</span>
          <b>
            {formatNumber(
              row.positionPrice ?? row.position_price ?? row.avgBuyCost ?? row.avg_cost
            )}
          </b>
        </div>
        <div>
          <span>TP</span>
          <b>{formatNumber(row.targetPrice ?? row.target_price)}</b>
        </div>
        <div>
          <span>P&L</span>
          <b className={pnl >= 0 ? 'tce-positive' : 'tce-negative'}>
            {pnl >= 0 ? '+' : ''}
            {formatNumber(pnl)}
          </b>
        </div>
      </div>
      <button className="tce-secondary-action" onClick={onSell}>
        SELL
      </button>
    </article>
  );
}
function DividendCard({
  item,
  pool,
  marketPrice,
}: {
  item: { symbol: string; events: StockEvent[] };
  pool?: any;
  marketPrice?: number;
}) {
  const event = item.events[0];
  const price = marketPrice ?? pool?.currentPrice ?? pool?.current_price;
  return (
    <article className="tce-dividend-card">
      <div>
        <strong>{item.symbol}</strong>
        <span>Dividend Pool</span>
      </div>
      <div className="tce-dividend-info">
        <span>Next ex-date</span>
        <b>{formatDate(event?.exDividendDate)}</b>
        <span>Rate</span>
        <b>{String(event?.dividendRate ?? '—')}</b>
      </div>
      <div className="tce-pool-grid">
        <div>
          <span>Price</span>
          <b>{formatNumber(price)}</b>
        </div>
        <div>
          <span>Entry</span>
          <b>
            {formatEntry(pool?.entryLow ?? pool?.entry_low, pool?.entryHigh ?? pool?.entry_high)}
          </b>
        </div>
        <div>
          <span>TP</span>
          <b>{formatNumber(pool?.targetPrice ?? pool?.target_price)}</b>
        </div>
      </div>
    </article>
  );
}
function SettingRow({
  icon,
  label,
  value,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="tce-setting-row">
      <span className="tce-setting-icon">{icon}</span>
      <strong>{label}</strong>
      <span className={ok ? 'tce-positive' : ''}>{value}</span>
    </div>
  );
}
function EmptyState({ text }: { text: string }) {
  return <div className="tce-empty">{text}</div>;
}
function MiniChart({ positive }: { positive: boolean }) {
  return (
    <svg
      className={positive ? 'tce-mini-chart positive' : 'tce-mini-chart'}
      viewBox="0 0 120 42"
      aria-hidden="true"
    >
      <polyline
        points="2,32 18,28 31,30 44,19 57,24 71,15 84,18 98,8 118,11"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function symbolOf(row: any) {
  return String(row.symbol ?? row.code ?? row.name ?? '—')
    .trim()
    .toUpperCase();
}
function number(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function sum(values: any[]) {
  return values.reduce((total, value) => total + number(value), 0);
}
function money(value: any) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(number(value));
}
function signedMoney(value: any) {
  const n = number(value);
  return `${n >= 0 ? '+' : '-'}${money(Math.abs(n))}`;
}
function formatNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)
    : '—';
}
function signedPercent(value: any) {
  const n = number(value);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function formatEntry(low: any, high: any) {
  if (low == null && high == null) return '—';
  if (low != null && high != null) return `${formatNumber(low)}–${formatNumber(high)}`;
  return formatNumber(low ?? high);
}
function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}
function timeNow() {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
