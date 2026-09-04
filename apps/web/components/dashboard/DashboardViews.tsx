'use client';

import { useState } from 'react';
import {
  ArrowLeftRight,
  ChevronRight,
  Layers3,
  ShoppingCart,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import PlatformConfigTab from '../config/PlatformConfigTab';
import type { DashboardActions, DashboardData, TradePayload } from './DashboardShell';

export function OverviewView({
  data,
  actions,
}: {
  data: DashboardData;
  actions: DashboardActions;
}) {
  const { positions, pools, next, orders, visibleAccounts, portfolioValue, invested } = data;
  return (
    <div className="dashboard-view dashboard-view-overview">
      <Card className="hero-card">
        <CardContent className="p-4">
          <div className="hero-card-top">
            <div>
              <p className="metric-label">Total portfolio value</p>
              <p className="metric-value">{money(portfolioValue)}</p>
            </div>
            <div className="hero-status">LIVE</div>
          </div>
          <div className="metric-grid">
            <Metric label="Invested" value={money(invested)} />
            <Metric label="Positions" value={String(positions.length)} />
            <Metric label="Accounts" value={String(visibleAccounts.length || '—')} />
          </div>
        </CardContent>
      </Card>

      {visibleAccounts.length > 0 && (
        <section className="dashboard-accounts">
          <SectionHeader
            title="Connected accounts"
            caption={`${visibleAccounts.length} connected`}
          />
          <div className="account-strip">
            {visibleAccounts.slice(0, 3).map((item: any, index: number) => (
              <div
                key={item.id ?? item.accountNo ?? item.externalAccountNo ?? index}
                className="account-chip"
              >
                <span className="account-chip-icon">
                  {String(item.provider ?? item.broker ?? 'ACC')
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
                <span className="min-w-0">
                  <strong>{String(item.provider ?? item.broker ?? 'Account')}</strong>
                  <small>
                    {String(
                      item.accountNo ?? item.externalAccountNo ?? item.environment ?? 'Connected'
                    )}
                  </small>
                </span>
                <span className="account-dot" />
              </div>
            ))}
          </div>
        </section>
      )}

      <Panel
        title="Current Positions"
        caption={`${positions.length} assets`}
        icon={WalletCards}
        action={() => window.location.assign('/position')}
      >
        <AssetList rows={positions} />
      </Panel>
      <Panel
        title="Next Positions"
        caption={next.length ? `${next.length} candidates` : 'Candidates'}
        icon={TrendingUp}
        action={next.length > 5 ? () => window.location.assign('/position') : undefined}
      >
        <AssetList rows={next} kind="candidate" onTrade={actions.openNextPositionOrder} />
      </Panel>
      <Panel
        title="Shared Pools"
        caption={`${pools.length} watching`}
        icon={Layers3}
        action={pools.length > 5 ? () => window.location.assign('/position') : undefined}
      >
        <AssetList
          rows={pools}
          kind="pool"
          onTrade={actions.openTrade}
          onPromote={actions.promotePool}
          promoteBusy={actions.promoteBusy}
        />
      </Panel>
      <Panel
        title="Recent Orders"
        caption={`${orders.length} orders`}
        icon={ShoppingCart}
        action={() => window.location.assign('/order')}
      >
        <AssetList rows={orders} />
      </Panel>
    </div>
  );
}

export function PositionsView({ data }: { data: DashboardData }) {
  return (
    <CompactDataView
      title="Positions"
      caption="Current asset exposure"
      rows={data.positions}
      columns={['symbol', 'quantity', 'avgBuyCost', 'marketPrice', 'unrealizedPnl']}
    />
  );
}

export function OrdersView({ data }: { data: DashboardData }) {
  return (
    <CompactDataView
      title="Orders"
      caption="Execution history"
      rows={data.orders}
      columns={['side', 'symbol', 'quantity', 'price', 'status', 'fee', 'tax']}
    />
  );
}

export function SettingsView() {
  return (
    <div className="dashboard-view dashboard-view-settings">
      <PlatformConfigTab />
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
  return (
    <div className="asset-list">
      {rows.slice(0, 4).map((row, i) => {
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
        return (
          <div key={row.id ?? row.symbol ?? row.code ?? i} className="asset-row">
            <div className="asset-main">
              <div className="asset-symbol">{symbol}</div>
              <div className="asset-secondary">{secondary}</div>
            </div>
            <div className="asset-value">{primaryValue}</div>
            {isCandidate && onTrade && (
              <div className="asset-actions">
                <button type="button" className="primary-action" onClick={() => onTrade(row)}>
                  Create order
                </button>
              </div>
            )}
            {isPool && (
              <div className="asset-actions">
                {onTrade && (
                  <button type="button" className="panel-action" onClick={() => onTrade(row)}>
                    Trade
                  </button>
                )}
                {onPromote && row.id && (
                  <button
                    type="button"
                    className="panel-action"
                    onClick={() => onPromote(row)}
                    disabled={promoteBusy === String(row.id)}
                  >
                    {promoteBusy === String(row.id) ? '…' : 'Promote'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CompactDataView({
  title,
  caption,
  rows,
  columns,
}: {
  title: string;
  caption: string;
  rows: any[];
  columns: string[];
}) {
  return (
    <section className="mobile-data-view">
      <SectionHeader
        title={title}
        caption={`${rows.length} ${rows.length === 1 ? 'item' : 'items'}`}
      />
      <Card className="data-card">
        <div className="mobile-records">
          {rows.map((row, index) => (
            <div className="mobile-record" key={row.id ?? row.symbol ?? index}>
              <div className="mobile-record-grid">
                {columns.map((column, columnIndex) => (
                  <div
                    key={column}
                    className={columnIndex === 0 ? 'record-primary' : 'record-field'}
                  >
                    <span>{column}</span>
                    <strong>{String(getValue(row, column) ?? '—')}</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {rows.length > 5 && (
          <div className="list-footer">
            <span>Scroll to view all {rows.length}</span>
          </div>
        )}
      </Card>
    </section>
  );
}

function SectionHeader({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      <span>{caption}</span>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="metric-label">{label}</p>
      <p className="metric-secondary">{value}</p>
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
function getValue(row: any, key: string) {
  return row[key] ?? row[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)];
}
function money(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric)
    : '—';
}
function formatNumber(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric)
    : '—';
}

export function TradeTicket({
  pool,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  pool: any;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: TradePayload) => void;
}) {
  const [side, setSide] = useState<'BUY' | 'SELL'>((pool?.side ?? 'BUY') as 'BUY' | 'SELL');
  const [quantity, setQuantity] = useState(
    String(pool?.quantity ?? pool?.targetQuantity ?? pool?.target_quantity ?? 100)
  );
  const [orderType, setOrderType] = useState<TradePayload['orderType']>('LO');
  const [price, setPrice] = useState(String(pool?.currentPrice ?? pool?.current_price ?? ''));
  const numericQuantity = Number(quantity);
  const numericPrice = Number(price);
  const isNextPosition = pool?.__orderSource === 'next-position';
  return (
    <div className="trade-overlay" role="dialog" aria-modal="true">
      <Card className="trade-ticket">
        <div className="panel-head">
          <div>
            <h2>
              {isNextPosition ? 'Create order' : 'Trade'}{' '}
              {String(pool?.symbol ?? pool?.code ?? 'asset').toUpperCase()}
            </h2>
            <p>{isNextPosition ? 'Create SSI buy order from Next Position' : 'SSI order'}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close trade ticket"
            disabled={busy}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="trade-controls">
          <div className="trade-side-toggle">
            <button
              type="button"
              className={side === 'BUY' ? 'active' : ''}
              onClick={() => setSide('BUY')}
              disabled={busy || isNextPosition}
            >
              BUY
            </button>
            <button
              type="button"
              className={side === 'SELL' ? 'active' : ''}
              onClick={() => setSide('SELL')}
              disabled={busy || isNextPosition}
            >
              SELL
            </button>
          </div>
          <label>
            Quantity
            <input
              inputMode="numeric"
              value={quantity}
              onChange={event => setQuantity(event.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Order type
            <select
              value={orderType}
              onChange={event => setOrderType(event.target.value as TradePayload['orderType'])}
              disabled={busy}
            >
              <option value="LO">LO</option>
              <option value="MTL">MTL</option>
              <option value="MP">MP</option>
              <option value="ATO">ATO</option>
              <option value="ATC">ATC</option>
              <option value="MOK">MOK</option>
              <option value="MAK">MAK</option>
              <option value="PLO">PLO</option>
            </select>
          </label>
          {orderType === 'LO' && (
            <label>
              Price
              <input
                inputMode="decimal"
                value={price}
                onChange={event => setPrice(event.target.value)}
                disabled={busy}
              />
            </label>
          )}
        </div>
        <Button
          type="button"
          onClick={() =>
            onSubmit({
              side,
              quantity: numericQuantity,
              orderType,
              price: orderType === 'LO' ? numericPrice : undefined,
            })
          }
          disabled={
            busy ||
            !Number.isFinite(numericQuantity) ||
            numericQuantity <= 0 ||
            (orderType === 'LO' && (!Number.isFinite(numericPrice) || numericPrice <= 0))
          }
        >
          {busy ? 'Submitting…' : 'Place order'}
        </Button>
        {error && <div className="error-banner">{error}</div>}
      </Card>
    </div>
  );
}
