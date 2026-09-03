'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  ChevronRight,
  Cpu,
  Home,
  Layers3,
  LogOut,
  RefreshCw,
  Settings,
  ShoppingCart,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import PlatformConfigTab from '../../components/config/PlatformConfigTab';
import { NavigationDock } from '../../components/navigation/NavigationDock';
import { useAuthStore, useDashboardStore } from '../../lib/store';
import { dashboardApi, platformApi } from '../../lib/api';

type Tab = 'overview' | 'positions' | 'orders' | 'settings';
type NavItem = {
  id: 'overview' | 'positions' | 'orders' | 'engine' | 'notifications' | 'settings';
  label: string;
  icon: typeof Home;
  href: string;
};
const navigation: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Home, href: '/dashboard' },
  { id: 'positions', label: 'Positions', icon: BarChart3, href: '/dashboard?tab=positions' },
  { id: 'orders', label: 'Orders', icon: ArrowLeftRight, href: '/dashboard?tab=orders' },
  { id: 'engine', label: 'Engine', icon: Cpu, href: '/engines' },
  { id: 'notifications', label: 'Notifications', icon: Bell, href: '/notifications' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/dashboard?tab=settings' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, initialized, init, logout } = useAuthStore();
  const { data, loading, error, load } = useDashboardStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [tradePool, setTradePool] = useState<any | null>(null);
  const [tradeError, setTradeError] = useState('');
  const [tradeBusy, setTradeBusy] = useState(false);
  const [promoteBusy, setPromoteBusy] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState('');

  useEffect(() => {
    void init();
  }, [init]);
  useEffect(() => {
    if (initialized && !user) router.replace('/login');
  }, [initialized, user, router]);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (
      requested === 'overview' ||
      requested === 'positions' ||
      requested === 'orders' ||
      requested === 'settings'
    )
      setTab(requested);
  }, []);
  useEffect(() => {
    if (user) void load();
  }, [user, load]);
  if (authLoading || !initialized || !user)
    return (
      <main className="app-shell">
        <Loading />
      </main>
    );
  const account = data?.account ?? {};
  const positions = data?.positions ?? data?.currentPositions ?? [];
  const pools = data?.pools ?? [];
  const next = data?.nextPositions ?? data?.candidates ?? [];
  const orders = data?.orders ?? data?.recentOrders ?? [];
  const accounts = data?.brokerAccounts ?? data?.accounts ?? [];
  const invested = account.capital_deployed ?? account.capitalDeployed ?? account.investedValue;
  const portfolioValue = account.totalValue ?? account.portfolioValue ?? account.equity;
  const visibleAccounts =
    Array.isArray(accounts) && accounts.length ? accounts : inferAccounts(positions);
  const ssiAccountNo = findSsiAccountNo(visibleAccounts);
  const navigationItems = navigation.map(item => ({
    ...item,
    active: item.id !== 'engine' && item.id !== 'notifications' && tab === item.id,
  }));

  const openTrade = (pool: any) => {
    setTradeError('');
    setTradePool({ ...pool, __ssiAccountNo: ssiAccountNo });
  };
  const promotePool = async (pool: any) => {
    const poolId = String(pool?.id ?? '').trim();
    if (!poolId) return;
    setPromoteBusy(poolId);
    setPromoteError('');
    try {
      await dashboardApi.promotePool(poolId);
      await load();
    } catch (err: any) {
      setPromoteError(
        err?.response?.data?.message ??
          err?.response?.data?.error?.message ??
          err?.message ??
          'Unable to promote pool item'
      );
    } finally {
      setPromoteBusy(null);
    }
  };

  const submitTrade = async (payload: {
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'LO' | 'MTL' | 'MP' | 'ATO' | 'ATC' | 'MOK' | 'MAK' | 'PLO';
    price?: number;
  }) => {
    if (!tradePool) return;
    setTradeBusy(true);
    setTradeError('');
    try {
      const environment = String(tradePool.environment ?? 'production');
      const accountNo = String(tradePool.__ssiAccountNo ?? tradePool.accountNo ?? '').trim();
      if (!accountNo)
        throw new Error('SSI account is not configured. Connect SSI in Settings first.');
      await platformApi.ssiOrder({
        environment,
        accountNo,
        symbol: String(tradePool.symbol ?? tradePool.code ?? '').toUpperCase(),
        ...payload,
      });
      setTradePool(null);
      await load();
    } catch (err: any) {
      setTradeError(
        err?.response?.data?.message ??
          err?.response?.data?.error?.message ??
          err?.message ??
          'Order failed'
      );
    } finally {
      setTradeBusy(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-container app-header-inner">
          <div className="account-identity">
            <div className="brand-orb">
              <Activity className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="eyebrow">TCE account</p>
              <p className="account-email">{user.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="touch-target"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <div className="app-container app-content">
        {tab !== 'settings' && (
          <section className="page-heading">
            <div className="min-w-0">
              <p className="eyebrow">Portfolio</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="touch-target shrink-0"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </section>
        )}
        {tab !== 'settings' && (
          <Card className="hero-card mb-4">
            <CardContent className="p-5 sm:p-6">
              <div className="hero-card-top">
                <div>
                  <p className="metric-label">Total portfolio value</p>
                  <p className="metric-value">{money(portfolioValue)}</p>
                </div>
                <div className="hero-status">LIVE</div>
              </div>
              <div className="metric-grid">
                <Metric label="Current invested" value={money(invested)} />
                <Metric label="Positions" value={String(positions.length)} />
                <Metric label="Accounts" value={String(visibleAccounts.length || '—')} />
              </div>
            </CardContent>
          </Card>
        )}
        {tab !== 'settings' && visibleAccounts.length > 0 && (
          <section className="mb-5">
            <SectionHeader title="Connected accounts" caption="Multi-account asset view" />
            <div className="account-strip">
              {visibleAccounts.slice(0, 6).map((item: any, index: number) => (
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
        {tab === 'overview' && (
          <div className="dashboard-sections">
            <Panel
              title="Current Positions"
              caption={`${positions.length} assets`}
              icon={WalletCards}
              action={() => {
                router.push('/dashboard?tab=positions');
              }}
            >
              <AssetList rows={positions} />
            </Panel>
            <Panel
              title="Next Positions"
              caption={next.length ? `${next.length} candidates` : 'Candidates'}
              icon={TrendingUp}
            >
              <AssetList rows={next} kind="candidate" />
            </Panel>
            <Panel title="Shared Pools" caption={`${pools.length} watching`} icon={Layers3}>
              <AssetList
                rows={pools}
                kind="pool"
                onTrade={openTrade}
                onPromote={promotePool}
                promoteBusy={promoteBusy}
              />
            </Panel>
            <Panel
              title="Recent Orders"
              caption={`${orders.length} orders`}
              icon={ShoppingCart}
              action={() => {
                router.push('/dashboard?tab=orders');
              }}
            >
              <AssetList rows={orders} />
            </Panel>
          </div>
        )}
        {tab === 'positions' && (
          <MobileDataView
            title="Positions"
            caption="Current asset exposure"
            rows={positions}
            columns={['symbol', 'quantity', 'avgBuyCost', 'marketPrice', 'unrealizedPnl']}
          />
        )}
        {tab === 'orders' && (
          <MobileDataView
            title="Orders"
            caption="Execution history"
            rows={orders}
            columns={['side', 'symbol', 'quantity', 'price', 'status', 'fee', 'tax']}
          />
        )}
        {tab === 'settings' && <PlatformConfigTab />}
        {error && <div className="error-banner">{error}</div>}
        {promoteError && <div className="error-banner">{promoteError}</div>}
      </div>
      <NavigationDock items={navigationItems} />
      {tradePool && (
        <TradeTicket
          pool={tradePool}
          busy={tradeBusy}
          error={tradeError}
          onClose={() => !tradeBusy && setTradePool(null)}
          onSubmit={submitTrade}
        />
      )}
    </main>
  );
}

function findSsiAccountNo(accounts: any[]) {
  const ssi = accounts.find(
    item => String(item.provider ?? item.broker ?? '').toLowerCase() === 'ssi'
  );
  const direct = ssi?.accountNo ?? ssi?.externalAccountNo;
  return direct == null ? '' : String(direct).trim();
}
function inferAccounts(positions: any[]) {
  const map = new Map<string, any>();
  for (const row of positions) {
    const key = String(row.provider ?? row.broker ?? row.accountNo ?? 'portfolio');
    if (!map.has(key)) map.set(key, { provider: key, accountNo: row.accountNo });
  }
  return [...map.values()];
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="metric-label">{label}</p>
      <p className="metric-secondary">{value}</p>
    </div>
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
          <button className="panel-action" onClick={action}>
            View all
            <ChevronRight className="size-4" />
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
      {rows.slice(0, 6).map((row, i) => {
        const symbol = String(row.symbol ?? row.code ?? row.name ?? `Item ${i + 1}`);
        const isPool = kind === 'pool';
        const isCandidate = kind === 'candidate';
        const rank = row.rank == null ? null : Number(row.rank);
        const score = row.score == null ? null : Number(row.score);
        const currentPrice = row.currentPrice ?? row.current_price;
        const targetPrice = row.targetPrice ?? row.target_price;
        const entryLow = row.entryLow ?? row.entry_low;
        const entryHigh = row.entryHigh ?? row.entry_high;
        const expectedHoldDays = row.expectedHoldDays ?? row.expected_hold_days;
        const quantity = row.quantity ?? row.targetQuantity ?? row.target_quantity ?? row.total;
        const primaryValue =
          isPool && currentPrice != null
            ? formatNumber(currentPrice)
            : isCandidate && targetPrice != null
              ? `TP ${formatNumber(targetPrice)}`
              : isPool && entryLow != null && entryHigh != null
                ? `${formatNumber(entryLow)}–${formatNumber(entryHigh)}`
                : money(row.marketValue ?? row.market_value ?? row.price);
        const hold = formatHoldDays(expectedHoldDays);
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
              {hold && <div className="asset-hold">{hold}</div>}
            </div>
            <div className="asset-value">{primaryValue}</div>
            {isPool && (
              <div className="asset-actions">
                {onTrade && (
                  <button className="panel-action" onClick={() => onTrade(row)}>
                    Trade
                  </button>
                )}
                {onPromote && row.id && (
                  <button
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

function formatHoldDays(value: any) {
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return '';
  return `Hold ~${Math.trunc(days)} day${Math.trunc(days) === 1 ? '' : 's'}`;
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

function MobileDataView({
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
    <section className="mb-6">
      <SectionHeader title={title} caption={caption} />
      <Card className="panel-card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map(column => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id ?? row.symbol ?? index}>
                  {columns.map(column => (
                    <td key={column}>{String(getValue(row, column) ?? '—')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
function getValue(row: any, key: string) {
  return row[key] ?? row[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)];
}
function money(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(numeric);
}
function formatNumber(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(numeric);
}

function Loading() {
  return <div className="loading-state">Loading dashboard…</div>;
}

function TradeTicket({
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
  onSubmit: (payload: {
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'LO' | 'MTL' | 'MP' | 'ATO' | 'ATC' | 'MOK' | 'MAK' | 'PLO';
    price?: number;
  }) => void;
}) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('100');
  const [orderType, setOrderType] = useState<
    'LO' | 'MTL' | 'MP' | 'ATO' | 'ATC' | 'MOK' | 'MAK' | 'PLO'
  >('LO');
  const [price, setPrice] = useState(String(pool?.currentPrice ?? pool?.current_price ?? ''));
  const numericQuantity = Number(quantity);
  const numericPrice = Number(price);

  return (
    <div className="trade-overlay" role="dialog" aria-modal="true">
      <Card className="trade-ticket">
        <div className="panel-head">
          <div>
            <h2>Trade {String(pool?.symbol ?? pool?.code ?? 'asset').toUpperCase()}</h2>
            <p>SSI order</p>
          </div>
          <button
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
              className={side === 'BUY' ? 'active' : ''}
              onClick={() => setSide('BUY')}
              disabled={busy}
            >
              BUY
            </button>
            <button
              className={side === 'SELL' ? 'active' : ''}
              onClick={() => setSide('SELL')}
              disabled={busy}
            >
              SELL
            </button>
          </div>
          <label>
            Quantity
            <input
              value={quantity}
              onChange={event => setQuantity(event.target.value)}
              inputMode="numeric"
              disabled={busy}
            />
          </label>
          <label>
            Order type
            <select
              value={orderType}
              onChange={event => setOrderType(event.target.value as typeof orderType)}
              disabled={busy}
            >
              {['LO', 'MTL', 'MP', 'ATO', 'ATC', 'MOK', 'MAK', 'PLO'].map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Price
            <input
              value={price}
              onChange={event => setPrice(event.target.value)}
              inputMode="decimal"
              disabled={busy}
            />
          </label>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="trade-actions">
          <button className="panel-action" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="primary-action"
            onClick={() =>
              Number.isFinite(numericQuantity) && numericQuantity > 0
                ? onSubmit({
                    side,
                    quantity: numericQuantity,
                    orderType,
                    ...(orderType === 'LO' && Number.isFinite(numericPrice)
                      ? { price: numericPrice }
                      : {}),
                  })
                : undefined
            }
            disabled={busy || !Number.isFinite(numericQuantity) || numericQuantity <= 0}
          >
            {busy
              ? 'Submitting…'
              : `${side} ${String(pool?.symbol ?? pool?.code ?? '').toUpperCase()}`}
          </button>
        </div>
      </Card>
    </div>
  );
}
