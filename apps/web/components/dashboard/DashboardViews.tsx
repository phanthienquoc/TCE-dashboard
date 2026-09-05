'use client';

import { ChevronRight, Layers3, ShoppingCart, TrendingUp, WalletCards } from 'lucide-react';
import { Card } from '../ui/card';
import PlatformConfigTab from '../config/PlatformConfigTab';
import { ListView } from '../../shareComponent/list-view';
import { PortfolioComponent } from '../../shareComponent/portfolio-component';
import type { DashboardActions, DashboardData } from './DashboardShell';

export function OverviewView({
  data,
}: {
  data: DashboardData;
  actions: DashboardActions;
}) {
  return (
    <div className="dashboard-view dashboard-view-overview">
      <PortfolioComponent
        positions={data.positions}
        accounts={data.visibleAccounts}
        portfolioValue={data.portfolioValue}
      />

      <Panel
        title="Current Positions"
        caption={`${data.positions.length} assets`}
        icon={WalletCards}
        action={() => window.location.assign('/position')}
      >
        <AssetList rows={data.positions} />
      </Panel>
    </div>
  );
}

function rowsToPositionListItems(rows: any[]) {
  return rows.map((row, index) => {
    const symbol = String(row.symbol ?? row.code ?? row.name ?? `Item ${index + 1}`);
    const quantity = Number(row.quantity ?? 0);
    const avgCost = Number(row.avgBuyCost ?? row.avg_cost ?? 0);
    const marketPrice = row.marketPrice ?? row.market_price;
    const marketValue = row.marketValue ?? row.market_value;
    const pnl = row.unrealizedPnl ?? row.unrealized_pnl;
    const investedValue =
      row.costBasis ??
      row.cost_basis ??
      (Number.isFinite(quantity) && Number.isFinite(avgCost) ? quantity * avgCost : null);
    const pnlPct =
      investedValue != null && Number(investedValue) !== 0 && pnl != null
        ? (Number(pnl) / Number(investedValue)) * 100
        : null;

    return {
      id: row.id ?? row.symbol ?? row.code ?? index,
      title: symbol,
      description: `${formatNumber(quantity)} shares · Avg ${formatNumber(avgCost)} · Mkt ${formatNumber(marketPrice)}`,
      meta: `${String(row.status ?? 'OPEN')} · ${String(row.cycle_no ?? row.cycleNo ?? '—') === '—' ? 'Cycle —' : `Cycle ${row.cycle_no ?? row.cycleNo}`} · MV ${money(marketValue)}`,
      trailing: (
        <div className={`position-pnl ${Number(pnl ?? 0) >= 0 ? 'is-positive' : 'is-negative'}`}>
          <strong>{signedMoney(pnl)}</strong>
          <span>{pnlPct == null ? '—' : `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`}</span>
        </div>
      ),
    };
  });
}

export function PositionsView({
  data,
  actions,
}: {
  data: DashboardData;
  actions: DashboardActions;
}) {
  return (
    <div className="dashboard-view dashboard-view-positions">
      <section className="dashboard-data-section position-portfolio-page">
        <div className="position-list-card">
          <div className="position-list-header">
            <div>Code</div>
            <div>Volume</div>
            <div>Avg Price</div>
            <div>Invest Value</div>
            <div>Profit Loss</div>
          </div>
          <ListView items={rowsToPositionListItems(data.positions)} empty="No open positions" />
        </div>
      </section>

      <Panel
        title="Next Positions"
        caption={data.next.length ? `${data.next.length} candidates` : 'Candidates'}
        icon={TrendingUp}
      >
        <AssetList
          rows={data.next}
          kind="candidate"
          onTrade={actions.openNextPositionOrder}
        />
      </Panel>

      <Panel
        title="Shared Pools"
        caption={`${data.pools.length} watching`}
        icon={Layers3}
      >
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
      <Panel
        title="Recent Orders"
        caption={`${data.orders.length} orders`}
        icon={ShoppingCart}
      >
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

function AssetList({
  rows,
  kind = 'default',
  onTrade,
  onPromote,
  promoteBusy,
}: {
  rows: any[];
  kind?: 'default' | 'pool' | 'candidate';
  onTrade?: (row: any) => void;
  onPromote?: (row: any) => void;
  promoteBusy?: string | null;
}) {
  if (!rows.length) return <Empty kind={kind} />;

  const items = rows.slice(0, 4).map((row, i) => {
    const symbol = String(row.symbol ?? row.code ?? row.name ?? `Item ${i + 1}`);
    const isPool = kind === 'pool';
    const isCandidate = kind === 'candidate';
    const rank = row.rank == null ? null : Number(row.rank);
    const score = row.score == null ? null : Number(row.score);
    const currentPrice = row.currentPrice ?? row.current_price;
    const targetPrice = row.targetPrice ?? row.target_price;
    const entryLow = row.entryLow ?? row.entry_low;
    const entryHigh = row.entryHigh ?? row.entry_high;
    const quantity = row.quantity ?? row.targetQuantity ?? row.target_quantity ?? row.total;
    const primaryValue =
      isPool && currentPrice != null
        ? formatNumber(currentPrice)
        : isCandidate && targetPrice != null
          ? `TP ${formatNumber(targetPrice)}`
          : isPool && entryLow != null && entryHigh != null
            ? `${formatNumber(entryLow)}–${formatNumber(entryHigh)}`
            : money(row.marketValue ?? row.market_value ?? row.price);
    const secondary = isPool
      ? `#${rank ?? '—'} · ${score == null ? '—' : formatNumber(score)} · ${String(row.status ?? 'WATCHING')}`
      : isCandidate
        ? `#${rank ?? '—'} · ${String(row.status ?? 'CANDIDATE')}`
        : `${formatNumber(quantity ?? 0)} units · ${String(row.status ?? 'OPEN')}`;

    return {
      id: row.id ?? row.symbol ?? row.code ?? i,
      title: symbol,
      description: secondary,
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
            Create order
          </button>
        ) : null}
        {kind === 'pool' && onTrade ? (
          <button type="button" className="panel-action" onClick={() => onTrade(rows[index])}>
            Trade
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

function SectionHeader({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      <span>{caption}</span>
    </div>
  );
}

function Empty({ kind }: { kind: 'default' | 'pool' | 'candidate' }) {
  const message =
    kind === 'pool'
      ? 'No shared pool items'
      : kind === 'candidate'
        ? 'No candidates yet'
        : 'No data yet';
  return <div className="empty-state">{message}</div>;
}

function money(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric)
    : '—';
}

function signedMoney(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric >= 0 ? '+' : ''}${money(Math.abs(numeric))}`;
}

function formatNumber(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric)
    : '—';
}
