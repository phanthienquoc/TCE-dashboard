'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
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
import { useAuthStore, useDashboardStore } from '../../lib/store';
import { platformApi } from '../../lib/api';

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
              <h1>Investigate value / total</h1>
              <p className="page-subtitle">Live account exposure across every connected asset.</p>
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
            <Panel title="Shared Pools" caption={`${pools.length} watching`} icon={Layers3}>
              <AssetList rows={pools} kind="pool" onTrade={openTrade} />
            </Panel>
            <Panel
              title="Next Positions"
              caption={next.length ? `${next.length} candidates` : 'Candidates'}
              icon={TrendingUp}
            >
              <AssetList rows={next} kind="candidate" />
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
}: {
  rows: any[];
  kind?: 'default' | 'pool' | 'candidate';
  onTrade?: (row: any) => void;
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
            ? `#${rank ?? '—'} · ${String(row.status ?? 'queued').toUpperCase()}`
            : String(row.accountNo ?? row.status ?? row.type ?? 'OPEN');
        const tertiary = isPool
          ? entryLow != null && entryHigh != null
            ? `Entry ${formatNumber(entryLow)}–${formatNumber(entryHigh)}${targetPrice != null ? ` · Target ${formatNumber(targetPrice)}` : ''}`
            : targetPrice != null
              ? `Target ${formatNumber(targetPrice)}`
              : null
          : isCandidate && quantity != null
            ? `Qty ${formatNumber(quantity)}`
            : null;
        return (
          <div key={row.id ?? `${symbol}-${i}`} className="asset-row">
            <div className="asset-mark">{symbol.slice(0, 2).toUpperCase()}</div>
            <div className="asset-main">
              <p>{symbol}</p>
              <small>{secondary}</small>
              {tertiary && <small>{tertiary}</small>}
            </div>
            <div className="asset-value">
              <strong>
                {isPool
                  ? `Price ${primaryValue}`
                  : isCandidate
                    ? primaryValue
                    : formatQuantity(quantity)}
              </strong>
              <small>
                {isPool || isCandidate
                  ? ''
                  : money(row.marketValue ?? row.market_value ?? row.price)}
              </small>
            </div>
            {isPool && onTrade ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                  onClick={() => onTrade({ ...row, __defaultSide: 'BUY' })}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                  onClick={() => onTrade({ ...row, __defaultSide: 'SELL' })}
                >
                  Sell
                </button>
              </div>
            ) : (
              <ChevronRight className="size-4 shrink-0 text-[#675a70]" />
            )}
          </div>
        );
      })}
    </div>
  );
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
  }) => Promise<void>;
}) {
  const [side, setSide] = useState<'BUY' | 'SELL'>(pool.__defaultSide ?? 'BUY');
  const [quantity, setQuantity] = useState(String(pool.quantity ?? pool.targetQuantity ?? 100));
  const [orderType, setOrderType] = useState<
    'LO' | 'MTL' | 'MP' | 'ATO' | 'ATC' | 'MOK' | 'MAK' | 'PLO'
  >('LO');
  const defaultPrice = pool.currentPrice ?? pool.current_price ?? pool.entryHigh ?? pool.entry_high;
  const [price, setPrice] = useState(defaultPrice == null ? '' : String(defaultPrice));
  const symbol = String(pool.symbol ?? pool.code ?? '').toUpperCase();

  const submit = () => {
    const qty = Number(quantity);
    const orderPrice = price === '' ? undefined : Number(price);
    if (!Number.isInteger(qty) || qty <= 0) return;
    if (orderType === 'LO' && (!Number.isFinite(orderPrice) || Number(orderPrice) <= 0)) return;
    void onSubmit({ side, quantity: qty, orderType, price: orderPrice });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl border border-white/10 bg-[#151019] p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="eyebrow">SSI order</p>
            <h2 className="text-xl font-semibold">{symbol}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close order ticket">
            <X className="size-5" />
          </button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-lg px-4 py-3 text-sm font-semibold ${side === 'BUY' ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' : 'bg-white/5 text-white/60'}`}
            onClick={() => setSide('BUY')}
            disabled={busy}
          >
            Buy
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-3 text-sm font-semibold ${side === 'SELL' ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40' : 'bg-white/5 text-white/60'}`}
            onClick={() => setSide('SELL')}
            disabled={busy}
          >
            Sell
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-white/60">Quantity</span>
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none"
              inputMode="numeric"
              value={quantity}
              onChange={e => setQuantity(e.target.value.replace(/\D/g, ''))}
              disabled={busy}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-white/60">Order type</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none"
              value={orderType}
              onChange={e => setOrderType(e.target.value as typeof orderType)}
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
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-white/60">
            Price {orderType === 'LO' ? '(required)' : '(optional)'}
          </span>
          <input
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none"
            inputMode="decimal"
            value={price}
            onChange={e => setPrice(e.target.value)}
            disabled={busy || orderType !== 'LO'}
          />
        </label>
        {error && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {error}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !symbol}>
            {busy ? 'Submitting…' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${symbol}`}
          </Button>
        </div>
      </div>
    </div>
  );
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
    <section>
      <SectionHeader title={title} caption={caption} />
      <Card className="data-card">
        <div className="mobile-records">
          {rows.map((row, i) => (
            <div className="mobile-record" key={row.id ?? i}>
              {columns.map((column, index) => (
                <div key={column} className={index === 0 ? 'record-primary' : 'record-field'}>
                  <span>{column.replace(/[A-Z]/g, m => ` ${m}`).toUpperCase()}</span>
                  <strong>{String(row?.[column] ?? '—')}</strong>
                </div>
              ))}
            </div>
          ))}
        </div>
        {!rows.length && <Empty />}
      </Card>
    </section>
  );
}
function Empty({ kind = 'default' }: { kind?: 'default' | 'pool' | 'candidate' }) {
  return (
    <div className="empty-state">
      <Layers3 className="size-5" />
      <span>
        {kind === 'candidate'
          ? 'No promoted candidates'
          : kind === 'pool'
            ? 'No watching pool entries'
            : 'No data yet'}
      </span>
    </div>
  );
}
function Loading() {
  return (
    <div className="loading-state">
      <div className="brand-orb">
        <Activity className="size-4" />
      </div>
      <div>
        <strong>Opening TCE</strong>
        <span>Checking secure session…</span>
      </div>
    </div>
  );
}
function money(value: unknown) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : String(value);
}
function formatNumber(value: unknown) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { maximumFractionDigits: 4 })
    : String(value);
}
function formatQuantity(value: unknown) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { maximumFractionDigits: 4 })
    : String(value);
}
