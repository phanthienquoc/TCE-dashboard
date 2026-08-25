'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBackendStatus } from '../services/auth';
import { getDashboardData } from '../services/dashboard';
import { useAuthStore } from '../lib/auth-store';
import { useAuth } from '../lib/auth-context';
import PlatformsPanel from './platforms/PlatformsPanel';

const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
const num = (value) => Number(value || 0).toLocaleString('vi-VN');

export default function DashboardPage() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const { accessToken, ready, signOut } = useAuth();
  const [data, setData] = useState(null);
  const [backend, setBackend] = useState({ ok: false, checking: true });
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    let active = true;
    if (!hydrated || !ready) return () => { active = false; };
    if (!accessToken) { router.replace('/login'); return () => { active = false; }; }

    const load = async () => {
      try {
        const status = await getBackendStatus();
        if (!active) return;
        setBackend({ ...status, ok: status?.configured !== false, checking: false });
        const dashboard = await getDashboardData();
        if (active) setData(dashboard);
      } catch (err) {
        if (!active) return;
        if (err.message === 'Session expired' || err.response?.status === 401) {
          signOut();
          router.replace('/login');
          return;
        }
        setBackend((current) => ({ ...current, checking: false }));
        setError(err.response?.data?.message || err.message || 'Unable to load dashboard');
      }
    };

    void load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [accessToken, hydrated, ready, router, signOut]);

  const account = data?.account || {};
  const positions = data?.positions || [];
  const orders = data?.orders || [];
  const candidates = data?.nextPositions || data?.candidates || [];
  const deployed = account.capital_deployed || 0;
  const recovered = account.cashout_realized || 0;
  const target = account.cashout_target || 30000000;
  const recoveryPct = target ? Math.round(recovered / target * 100) : 0;
  const title = useMemo(() => ({ overview: 'Dashboard', positions: 'Positions', orders: 'Recent orders', platforms: 'Trading Platforms', security: 'Security' }[tab] || 'Dashboard'), [tab]);

  if (!hydrated || !ready || (!data && !error)) return <div className="loading-screen">Loading TCE…</div>;

  return <main>
    <div className={`backend-status ${backend.ok ? 'up' : 'down'}`}>● {backend.checking ? 'Checking backend…' : backend.ok ? 'Backend online' : 'Backend unavailable'}</div>
    <header className="app-header"><div><span className="eyebrow">TCE • TREASURY CASH EXTRACTION</span><h1>{title}</h1></div><button className="live" onClick={() => { signOut(); router.replace('/login'); }}>Sign out</button></header>
    {error && <div className="error-banner">{error}</div>}
    {tab === 'overview' && <>
      <section className="hero"><div><span>Investigate value / total</span><strong>{money(deployed)}</strong><small>Your positions • P/L {money(account.unrealized_pnl)}</small></div><div className="ring" style={{ '--p': `${recoveryPct}%` }}><b>{recoveryPct}%</b></div></section>
      <section className="section"><div className="section-head"><h2>Shared pools</h2><span>{(data?.pools || []).length}</span></div><div className="quick-links">{(data?.pools || []).slice(0, 4).map((pool) => <div className="quick-card" key={pool.symbol}><b>{pool.symbol}</b><span>{pool.status || 'ACTIVE'}</span></div>)}</div></section>
      <section className="section"><div className="section-head"><h2>Positions</h2><span>{positions.length}</span></div><div className="quick-links">{positions.length ? positions.slice(0, 5).map((position) => { const pnl = Number(position.unrealized_pnl || 0); return <div className="quick-card" key={position.id || position.symbol}><b>{position.symbol}</b><span>{num(position.quantity)} cp • buy {num(position.avg_cost)}</span><span>market {num(position.market_price)}</span><span className={pnl >= 0 ? 'up' : 'down'}>{money(pnl)}</span></div>; }) : <div className="empty">No open positions</div>}</div></section>
      <section className="section"><div className="section-head"><h2>Next positions</h2><span>Shared</span></div>{candidates.length ? candidates.slice(0, 5).map((candidate) => <div className="planned-row" key={`${candidate.rank}-${candidate.symbol}`}><span className="slot">{candidate.rank}</span><div><b>{candidate.symbol}</b><small>{candidate.target_quantity ? `${num(candidate.target_quantity)} cp` : ''}{candidate.target_price ? ` • target ${num(candidate.target_price)}` : ''}</small></div><span className="planned-status">{candidate.status}</span></div>) : <div className="empty">No shared candidates</div>}</section>
    </>}
    {tab === 'positions' && <section className="section page-section"><div className="section-head"><div><h2>Positions</h2><small>Your portfolio</small></div><span>{positions.length}</span></div><div className="cards">{positions.length ? positions.map((position) => <div className="position" key={position.id || position.symbol}><div><b>{position.symbol}</b><small>{position.quantity} cp • buy {num(position.avg_cost)} • market {num(position.market_price)} • cycle {position.cycle_no ?? 0}</small></div><div className="right"><b>{money(position.market_value || position.cost_basis)}</b><small className={(position.unrealized_pnl || 0) >= 0 ? 'up' : 'down'}>{money(position.unrealized_pnl)}</small></div></div>) : <div className="empty">No open positions</div>}</div></section>}
    {tab === 'orders' && <section className="section page-section"><div className="section-head"><div><h2>Recent orders</h2><small>Your account only</small></div><span>{orders.length}</span></div><div className="orders">{orders.length ? orders.map((order) => <div className="order" key={order.id || `${order.symbol}-${order.order_date}-${order.quantity}`}><span className={`badge ${order.side === 'BUY' ? 'buy' : 'sell'}`}>{order.side}</span><b>{order.symbol}</b><span>{order.quantity} × {num(order.price)}</span><strong>{money(order.gross_value)}</strong><small>{order.order_date || ''} • {order.status || 'UNKNOWN'} • fee {money(order.fee_tax)}</small></div>) : <div className="empty">No recent orders</div>}</div></section>}
    {tab === 'platforms' && <PlatformsPanel />}
    {tab === 'security' && <section className="section"><div className="security-card"><h2>Security</h2><p>JWT is attached centrally by Axios. Expired access tokens are refreshed once; failed refresh clears the local session.</p></div></section>}
    <nav>{[['⌂','Overview','overview'],['◫','Positions','positions'],['↕','Orders','orders'],['⚙','Platforms','platforms'],['◉','Security','security']].map(([icon, label, key]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{icon}<small>{label}</small></button>)}</nav>
  </main>;
}
