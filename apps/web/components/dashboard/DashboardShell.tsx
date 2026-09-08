'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import DashboardLayout from './DashboardLayout';
import { useAuthStore, useDashboardStore } from '../../lib/store';
import { dashboardApi, platformApi } from '../../lib/api';
import { useToast } from '../ui/toast';
import TradeTicket from './TradeTicket';

export type DashboardView = 'overview' | 'pools' | 'positions' | 'orders' | 'scan' | 'settings';
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
  cash: any;
};
export type DashboardActions = {
  refresh: () => void;
  openTrade: (row: any) => void;
  openPositionSell: (row: any) => void;
  openNextPositionOrder: (row: any) => void;
  promotePool: (row: any) => Promise<void>;
  returnNextPositionToPool: (row: any) => Promise<void>;
  promoteBusy: string | null;
  returnBusy: string | null;
};

export default function DashboardShell({
  view,
  children,
}: {
  view: DashboardView;
  children: (data: DashboardData, actions: DashboardActions) => ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading, initialized, init } = useAuthStore();
  const { data, loading, error, load } = useDashboardStore();
  const [tradePool, setTradePool] = useState<any | null>(null);
  const [tradeError, setTradeError] = useState('');
  const [tradeBusy, setTradeBusy] = useState(false);
  const [promoteBusy, setPromoteBusy] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState('');
  const [returnBusy, setReturnBusy] = useState<string | null>(null);
  const [returnError, setReturnError] = useState('');

  useEffect(() => {
    void init();
  }, [init]);
  useEffect(() => {
    if (initialized && !user) router.replace('/login');
  }, [initialized, user, router]);
  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (authLoading || !initialized || !user)
    return (
      <main className="app-shell">
        <div className="loading-state">Loading dashboard…</div>
      </main>
    );

  const account = data?.account ?? {};
  const positions = data?.positions ?? data?.currentPositions ?? [];
  const pools = data?.pools ?? [];
  const next = data?.nextPositions ?? data?.candidates ?? [];
  const orders = data?.orders ?? data?.recentOrders ?? [];
  const accounts = data?.brokerAccounts ?? data?.accounts ?? [];
  const invested = account.capital_deployed ?? account.capitalDeployed ?? account.investedValue;
  const cash = account.capital_available ?? account.capitalAvailable ?? data?.balance?.cash;
  const portfolioValue = account.totalValue ?? account.portfolioValue ?? account.equity;
  const visibleAccounts =
    Array.isArray(accounts) && accounts.length ? accounts : inferAccounts(positions);
  const ssiAccountNo = findSsiAccountNo(visibleAccounts);

  const openTrade = (pool: any) => {
    setTradeError('');
    setTradePool({ ...pool, __ssiAccountNo: ssiAccountNo, side: 'BUY' });
  };
  const openPositionSell = (position: any) => {
    setTradeError('');
    setTradePool({
      ...position,
      __ssiAccountNo: ssiAccountNo,
      side: 'SELL',
      quantity: Number(position?.quantity ?? 0),
      currentPrice: position?.marketPrice ?? position?.market_price,
    });
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
    const id = String(pool?.id ?? '').trim();
    if (!id) return;
    setPromoteBusy(id);
    setPromoteError('');
    try {
      await dashboardApi.promotePool(id);
      toast(`Promoted ${String(pool?.symbol ?? '').toUpperCase()} to Next Positions.`, 'success');
      await load();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.response?.data?.error?.message ??
        err?.message ??
        'Unable to promote pool item';
      setPromoteError(message);
      toast(message, 'error');
    } finally {
      setPromoteBusy(null);
    }
  };
  const returnNextPositionToPool = async (candidate: any) => {
    const id = String(candidate?.id ?? '').trim();
    if (!id) return;
    setReturnBusy(id);
    setReturnError('');
    try {
      await dashboardApi.returnNextPositionToPool(id);
      toast(
        `${String(candidate?.symbol ?? '').toUpperCase()} returned to Shared Pools.`,
        'success'
      );
      await load();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.response?.data?.error?.message ??
        err?.message ??
        'Unable to return Next Position to pool';
      setReturnError(message);
      toast(message, 'error');
    } finally {
      setReturnBusy(null);
    }
  };
  const submitTrade = async (payload: TradePayload) => {
    if (!tradePool) return;
    setTradeBusy(true);
    setTradeError('');
    try {
      const environment = String(tradePool.environment ?? 'production');
      const accountNo = String(tradePool.__ssiAccountNo ?? tradePool.accountNo ?? '').trim();
      if (!accountNo)
        throw new Error('SSI account is not configured. Connect SSI in Settings first.');
      const response = await platformApi.ssiOrder({
        environment,
        accountNo,
        symbol: String(tradePool.symbol ?? tradePool.code ?? '').toUpperCase(),
        ...payload,
      });
      const result = response.data;
      if (result?.ok === false)
        throw new Error(result?.error?.message ?? result?.message ?? 'SSI order failed');
      const symbol = String(tradePool.symbol ?? tradePool.code ?? '').toUpperCase();
      toast(
        `${payload.side} ${symbol} submitted to SSI${result?.data?.providerStatus ? ` (${result.data.providerStatus})` : ''}.`,
        'success'
      );
      setTradePool(null);
      await load();
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        err?.message ??
        'Order failed';
      setTradeError(message);
      toast(message, 'error');
    } finally {
      setTradeBusy(false);
    }
  };

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
    cash,
  };
  const actions: DashboardActions = {
    refresh: () => void load(),
    openTrade,
    openPositionSell,
    openNextPositionOrder,
    promotePool,
    returnNextPositionToPool,
    promoteBusy,
    returnBusy,
  };
  const heading =
    view === 'overview'
      ? 'Portfolio'
      : view === 'pools'
        ? 'Opportunities'
        : view === 'positions'
          ? 'Exposure'
          : view === 'scan'
            ? 'Market Scan'
            : view === 'settings'
              ? 'System'
              : 'Execution';

  return (
    <DashboardLayout
      activeId={view}
      overlay={
        tradePool ? (
          <TradeTicket
            pool={tradePool}
            busy={tradeBusy}
            error={tradeError}
            onClose={() => !tradeBusy && setTradePool(null)}
            onSubmit={submitTrade}
          />
        ) : null
      }
    >
      <section className="page-heading">
        <div className="min-w-0">
          <p className="eyebrow">{heading}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="touch-target shrink-0"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </section>
      {error && <div className="error-banner">{error}</div>}
      {promoteError && <div className="error-banner">{promoteError}</div>}
      {returnError && <div className="error-banner">{returnError}</div>}
      {children(viewData, actions)}
    </DashboardLayout>
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
