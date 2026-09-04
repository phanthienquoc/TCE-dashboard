'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Activity, ArrowLeftRight, BarChart3, Bell, Cpu, Home, LogOut, RefreshCw, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { NavigationDock } from '../navigation/NavigationDock';
import { useAuthStore, useDashboardStore } from '../../lib/store';
import { dashboardApi, platformApi } from '../../lib/api';
import TradeTicket from './TradeTicket';

export type DashboardView = 'overview' | 'positions' | 'orders' | 'settings';
export type TradePayload = {
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'LO' | 'MTL' | 'MP' | 'ATO' | 'ATC' | 'MOK' | 'MAK' | 'PLO';
  price?: number;
};
export type DashboardData = {
  account: any;
  positions: any[];
  pools: any[];
  next: any[];
  orders: any[];
  accounts: any[];
  visibleAccounts: any[];
  portfolioValue: any;
  invested: any;
};
export type DashboardActions = {
  refresh: () => void;
  openTrade: (row: any) => void;
  openNextPositionOrder: (row: any) => void;
  promotePool: (row: any) => Promise<void>;
  promoteBusy: string | null;
};

const navigation = [
  { id: 'overview' as const, label: 'Overview', icon: Home, href: '/overview' },
  { id: 'positions' as const, label: 'Positions', icon: BarChart3, href: '/position' },
  { id: 'orders' as const, label: 'Orders', icon: ArrowLeftRight, href: '/order' },
  { id: 'engine' as const, label: 'Engine', icon: Cpu, href: '/engine' },
  { id: 'notifications' as const, label: 'Notifications', icon: Bell, href: '/notifications' },
  { id: 'settings' as const, label: 'Settings', icon: Settings, href: '/settings' },
];

export default function DashboardShell({
  view,
  children,
}: {
  view: DashboardView;
  children: (data: DashboardData, actions: DashboardActions) => ReactNode;
}) {
  const router = useRouter();
  const { user, loading: authLoading, initialized, init, logout } = useAuthStore();
  const { data, loading, error, load } = useDashboardStore();
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
    if (user) void load();
  }, [user, load]);

  if (authLoading || !initialized || !user) {
    return <main className="app-shell"><div className="loading-state">Loading dashboard…</div></main>;
  }

  const account = data?.account ?? {};
  const positions = data?.positions ?? data?.currentPositions ?? [];
  const pools = data?.pools ?? [];
  const next = data?.nextPositions ?? data?.candidates ?? [];
  const orders = data?.orders ?? data?.recentOrders ?? [];
  const accounts = data?.brokerAccounts ?? data?.accounts ?? [];
  const invested = account.capital_deployed ?? account.capitalDeployed ?? account.investedValue;
  const portfolioValue = account.totalValue ?? account.portfolioValue ?? account.equity;
  const visibleAccounts = Array.isArray(accounts) && accounts.length ? accounts : inferAccounts(positions);
  const ssiAccountNo = findSsiAccountNo(visibleAccounts);

  const openTrade = (pool: any) => {
    setTradeError('');
    setTradePool({ ...pool, __ssiAccountNo: ssiAccountNo });
  };
  const openNextPositionOrder = (candidate: any) => {
    setTradeError('');
    setTradePool({
      ...candidate,
      __ssiAccountNo: ssiAccountNo,
      __orderSource: 'next-position',
      side: 'BUY',
      quantity: candidate?.targetQuantity ?? candidate?.target_quantity ?? 100,
      currentPrice: candidate?.targetPrice ?? candidate?.target_price ?? candidate?.currentPrice,
    });
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
        err?.response?.data?.message ?? err?.response?.data?.error?.message ?? err?.message ?? 'Unable to promote pool item'
      );
    } finally {
      setPromoteBusy(null);
    }
  };
  const submitTrade = async (payload: TradePayload) => {
    if (!tradePool) return;
    setTradeBusy(true);
    setTradeError('');
    try {
      const environment = String(tradePool.environment ?? 'production');
      const accountNo = String(tradePool.__ssiAccountNo ?? tradePool.accountNo ?? '').trim();
      if (!accountNo) throw new Error('SSI account is not configured. Connect SSI in Settings first.');
      await platformApi.ssiOrder({
        environment,
        accountNo,
        symbol: String(tradePool.symbol ?? tradePool.code ?? '').toUpperCase(),
        ...payload,
      });
      setTradePool(null);
      await load();
    } catch (err: any) {
      setTradeError(err?.response?.data?.message ?? err?.response?.data?.error?.message ?? err?.message ?? 'Order failed');
    } finally {
      setTradeBusy(false);
    }
  };

  const navigationItems = navigation.map(item => ({ ...item, active: item.id === view }));
  const viewData: DashboardData = {
    account,
    positions,
    pools,
    next,
    orders,
    accounts,
    visibleAccounts,
    portfolioValue,
    invested,
  };
  const actions: DashboardActions = {
    refresh: () => void load(),
    openTrade,
    openNextPositionOrder,
    promotePool,
    promoteBusy,
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-container app-header-inner">
          <div className="account-identity">
            <div className="brand-orb"><Activity className="size-4" /></div>
            <div className="min-w-0">
              <p className="eyebrow">TCE account</p>
              <p className="account-email">{user.email}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="touch-target"
            onClick={async () => { await logout(); router.replace('/login'); }}
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <div className="app-container app-content">
        {view !== 'settings' && (
          <section className="page-heading">
            <div className="min-w-0"><p className="eyebrow">{view === 'overview' ? 'Portfolio' : view === 'positions' ? 'Exposure' : 'Execution'}</p></div>
            <Button type="button" variant="outline" size="icon" className="touch-target shrink-0" onClick={() => void load()} disabled={loading} aria-label="Refresh">
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </section>
        )}
        {error && <div className="error-banner">{error}</div>}
        {promoteError && <div className="error-banner">{promoteError}</div>}
        {children(viewData, actions)}
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
  const ssi = accounts.find(item => String(item.provider ?? item.broker ?? '').toLowerCase() === 'ssi');
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
