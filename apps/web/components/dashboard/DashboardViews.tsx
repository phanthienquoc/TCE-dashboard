'use client';

import { ChevronRight, Layers3, ShoppingCart, TrendingUp, WalletCards } from 'lucide-react';
import { Card } from '../ui/card';
import PlatformConfigTab from '../config/PlatformConfigTab';
import { ListView } from '../../shareComponent/list-view';
import { PortfolioComponent } from '../../shareComponent/portfolio-component';
import { useStockEventStore, type StockEvent } from '../../lib/stock-event-store';
import type { DashboardActions, DashboardData } from './DashboardShell';
import { useEffect, useMemo } from 'react';

export function OverviewView({ data }: { data: DashboardData; actions: DashboardActions }) {
  return (
    <div className="dashboard-view dashboard-view-overview">
      <PortfolioComponent
        positions={data.positions}
        accounts={data.visibleAccounts}
        portfolioValue={data.portfolioValue}
        cash={data.cash}
      />
    </div>
  );
}

export function PositionsView({
  data,
  actions,
}: {
  data: DashboardData;
  actions: DashboardActions;
}) {
  const stockEvents = useStockEventStore(s => s.events);
  const stockEventsLoading = useStockEventStore(s => s.loading);
  const stockEventsError = useStockEventStore(s => s.error);
  const loadStockEvents = useStockEventStore(s => s.load);

  useEffect(() => {
    void loadStockEvents();
  }, [loadStockEvents]);

  const dividendPools = useMemo(() => {
    const eventsByTicker = new Map<string, StockEvent[]>();
    for (const event of stockEvents) {
      const ticker = String(event.ticker ?? '').trim().toUpperCase();
      if (!ticker) continue;
      const current = eventsByTicker.get(ticker) ?? [];
      current.push(event);
      eventsByTicker.set(ticker, current);
    }

    return [...eventsByTicker.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ticker, events]) => ({
        id: `dividend-${ticker}`,
        symbol: ticker,
        eventCount: events.length,
        nextExDate: events
          .map(event => event.exDividendDate)
          .filter(Boolean)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0],
      }));
  }, [stockEvents]);

  return (
    <div className="dashboard-view dashboard-view-positions">
      <Panel title="Current Positions" caption={`${data.positions.length} assets`} icon={WalletCards}>
        <AssetList rows={data.positions} kind="position" onTrade={actions.openPositionSell} />
      </Panel>

      <Panel
        title="Next Positions"
        caption={data.next.length ? `${data.next.length} candidates` : 'Candidates'}
        icon={TrendingUp}
      >
        <AssetList
          rows={data.next}
          kind="candidate"
          onTrade={actions.openNextPositionOrder}
          onReturn={actions.returnNextPositionToPool}
          returnBusy={actions.returnBusy}
        />
      </Panel>

      <Panel
        title="Stock Dividend Pools"
        caption={
          stockEventsLoading
            ? 'Loading…'
            : dividendPools.length
              ? `${dividendPools.length} stocks`
              : 'Upcoming dividend events'
        }
        icon={Layers3}
      >
        {stockEventsError ? (
          <div className="empty-state">{stockEventsError}</div>
        ) : (
          <DividendPoolList rows={dividendPools} />
        )}
      </Panel>

      <Panel title="Shared Pools" caption={`${data.pools.length} watching`} icon={Layers3}>
        <AssetList
          rows={data.pools}
          kind="pool"
          onTrade={actions.openTrade}
          onPromote={actions.promotePool}
          promoteBusy={actions.promoteBusy}
        />
      </Panel>
    </div>
  );
}

export function OrdersView({ data }: { data: DashboardData }) {
  return (
    <div className="dashboard-view dashboard-view-orders">
      <Panel title="Recent Orders" caption={`${data.orders.length} orders`} icon={ShoppingCart}>
        <AssetList rows={data.orders} />
      </Panel>
    </div>
  );
}

export function SettingsView() {
  return (
    <div className="dashboard-view dashboard-view-settings">
      <div className="settings-grid-intro">
        <p className="eyebrow">Workspace</p>
        <h1>Settings</h1>
        <p className="page-subtitle">Manage platform connections and environments.</p>
      </div>
      <div className="settings-grid-items">
        <PlatformConfigTab />
      </div>
    </div>
  );
}

function Panel({
  title,
  caption,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  caption: string;
  icon: typeof Layers3;
  action?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="panel-card">
      <div className="panel-head">
        <div className="flex min-w-0 items-center gap-3">
          <div className="panel-icon">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <h2>{title}</h2>
            <p>{caption}</p>
          </div>
        </div>
        {action && (
          <button type="button" className="panel-action" onClick={action}>
            View all <ChevronRight className="size-4" />
          </button>
        )}
      </div>
      <div className="panel-body">{children}</div>
    </Card>
  );
}

function DividendPoolList({ rows }: { rows: Array<{ id: string; symbol: string; eventCount: number; nextExDate?: string }> }) {
  if (!rows.length) return <div className="empty-state">No upcoming stock dividend pools</div>;

  return (
    <ListView
      items={rows.slice(0, 5).map(row => ({
        id: row.id,
        title: row.symbol,
        description: `${row.eventCount} dividend event${row.eventCount === 1 ? '' : 's'}${row.nextExDate ? ` · Next ex-date ${formatDate(row.nextExDate)}` : ''}`,
        trailing: <span className="asset-value">DIV</span>,
      }))}
    />
  );
}

function AssetList({
  rows,
  kind = 'default',
  onTrade,
  onPromote,
  promoteBusy,
  onReturn,
  returnBusy,
}: {
  rows: any[];
  kind?: 'default' | 'pool' | 'candidate' | 'position';
  onTrade?: (row: any) => void;
  onPromote?: (row: any) => void;
  promoteBusy?: string | null;
  onReturn?: (row: any) => void;
  returnBusy?: string | null;
}) {
  if (!rows.length) return <Empty kind={kind === 'position' ? 'default' : kind} />;

  const items = rows.slice(0, 4).map((row, i) => {
    const symbol = String(row.symbol ?? row.code ?? row.name ?? `Item ${i + 1}`);
    const isPool = kind === 'pool';
    const isCandidate = kind === 'candidate';
    const isPosition = kind === 'position';
    const rank = row.rank == null ? null : Number(row.rank);
    const score = row.score == null ? null : Number(row.score);
    const currentPrice = row.currentPrice ?? row.current_price ?? row.marketPrice ?? row.market_price;
    const targetPrice = row.targetPrice ?? row.target_price;
    const entryLow = row.entryLow ?? row.entry_low;
    const entryHigh = row.entryHigh ?? row.entry_high;
    const quantity = row.quantity ?? row.targetQuantity ?? row.target_quantity ?? row.total;
    const positionPrice = row.positionPrice ?? row.position_price ?? row.avgBuyCost ?? row.avg_cost;
    const marketPrice = row.marketPrice ?? row.market_price ?? currentPrice;
    const holdDays =
      row.estimateHoldDays ??
      row.estimate_hold_days ??
      row.holdDays ??
      row.hold_days ??
      row.expectedHoldDays ??
      row.expected_hold_days;

    const primaryValue =
      isCandidate && targetPrice != null
        ? `TP ${formatNumber(targetPrice)}`
        : isPool
          ? `Mkt ${formatNumber(currentPrice)}`
          : money(row.marketValue ?? row.market_value ?? row.price);

    const secondary = isPool
      ? `Entry ${formatEntry(entryLow, entryHigh)} · TP ${formatNumber(targetPrice)} · ${formatHoldDays(holdDays)}`
      : isCandidate
        ? `#${rank ?? '—'} · ${String(row.status ?? 'CANDIDATE')}`
        : isPosition
          ? `Pos ${formatNumber(positionPrice)} · Mkt ${formatNumber(marketPrice)}`
          : `${formatNumber(quantity ?? 0)} units · ${String(row.status ?? 'OPEN')}`;

    const poolMeta = isPool
      ? `#${rank ?? '—'} · ${score == null ? '—' : formatNumber(score)} · ${String(row.status ?? 'WATCHING')}`
      : null;

    return {
      id: row.id ?? row.symbol ?? row.code ?? i,
      title: symbol,
      description: secondary,
      meta: poolMeta,
      trailing: <span className="asset-value">{primaryValue}</span>,
    };
  });

  const actionable = items.map((item, index) => ({
    ...item,
    trailing: (
      <div className="asset-actions flex items-center gap-2">
        {item.trailing}
        {kind === 'candidate' && onTrade ? (
          <button type="button" className="primary-action" onClick={() => onTrade(rows[index])}>
            BUY
          </button>
        ) : null}
        {kind === 'candidate' && onReturn && rows[index]?.id ? (
          <button
            type="button"
            className="panel-action"
            onClick={() => onReturn(rows[index])}
            disabled={returnBusy === String(rows[index].id)}
          >
            {returnBusy === String(rows[index].id) ? '…' : 'To Pool'}
          </button>
        ) : null}
        {kind === 'pool' && onTrade ? (
          <button type="button" className="panel-action" onClick={() => onTrade(rows[index])}>
            BUY
          </button>
        ) : null}
        {kind === 'position' && onTrade ? (
          <button type="button" className="panel-action" onClick={() => onTrade(rows[index])}>
            SELL
          </button>
        ) : null}
        {kind === 'pool' && onPromote && rows[index]?.id ? (
          <button
            type="button"
            className="panel-action"
            onClick={() => onPromote(rows[index])}
            disabled={promoteBusy === String(rows[index].id)}
          >
            {promoteBusy === String(rows[index].id) ? '…' : 'Promote'}
          </button>
        ) : null}
      </div>
    ),
  }));

  return <ListView items={actionable} />;
}

function Empty({ kind }: { kind: 'default' | 'pool' | 'candidate' }) {
  const message = kind === 'pool' ? 'No shared pool items' : kind === 'candidate' ? 'No candidates yet' : 'No data yet';
  return <div className="empty-state">{message}</div>;
}

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}
function formatEntry(low: any, high: any) {
  if (low == null && high == null) return '—';
  if (low != null && high != null) return `${formatNumber(low)}–${formatNumber(high)}`;
  return formatNumber(low ?? high);
}
function formatHoldDays(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `~${numeric}d` : 'Hold —';
}
function money(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric) : '—';
}
function formatNumber(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric) : '—';
}
