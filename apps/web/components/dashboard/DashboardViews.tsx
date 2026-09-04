'use client';

import { useState } from 'react';
import {
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
import { Table } from '../../shareComponent/table';
import { ListView } from '../../shareComponent/list-view';
import { AccountCard } from '../../shareComponent/account-card';
import type { DashboardActions, DashboardData, TradePayload } from './DashboardShell';

export function OverviewView({ data, actions }: { data: DashboardData; actions: DashboardActions }) {
  const { positions, pools, next, orders, visibleAccounts, portfolioValue, invested } = data;
  return (
    <div className="dashboard-view dashboard-view-overview">
      <Card className="hero-card">
        <CardContent className="p-4">
          <div className="hero-card-top">
            <div><p className="metric-label">Total portfolio value</p><p className="metric-value">{money(portfolioValue)}</p></div>
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
          <SectionHeader title="Connected accounts" caption={`${visibleAccounts.length} connected`} />
          <div className="account-strip shared-account-strip">
            {visibleAccounts.map((item: any, index: number) => (
              <AccountCard key={item.id ?? item.accountNo ?? item.externalAccountNo ?? index}
                provider={String(item.provider ?? item.broker ?? 'Account')}
                identifier={String(item.accountNo ?? item.externalAccountNo ?? item.environment ?? 'Connected')}
                status={String(item.status ?? 'Connected')}
              />
            ))}
          </div>
        </section>
      )}
      <Panel title="Current Positions" caption={`${positions.length} assets`} icon={WalletCards} action={() => window.location.assign('/position')}><AssetList rows={positions} /></Panel>
      <Panel title="Next Positions" caption={next.length ? `${next.length} candidates` : 'Candidates'} icon={TrendingUp} action={next.length > 5 ? () => window.location.assign('/position') : undefined}><AssetList rows={next} kind="candidate" onTrade={actions.openNextPositionOrder} /></Panel>
      <Panel title="Shared Pools" caption={`${pools.length} watching`} icon={Layers3} action={pools.length > 5 ? () => window.location.assign('/position') : undefined}><AssetList rows={pools} kind="pool" onTrade={actions.openTrade} onPromote={actions.promotePool} promoteBusy={actions.promoteBusy} /></Panel>
      <Panel title="Recent Orders" caption={`${orders.length} orders`} icon={ShoppingCart} action={() => window.location.assign('/order')}><AssetList rows={orders} /></Panel>
    </div>
  );
}

export function PositionsView({ data }: { data: DashboardData }) {
  return <section className="dashboard-data-section"><SectionHeader title="Positions" caption={`${data.positions.length} ${data.positions.length === 1 ? 'item' : 'items'}`} /><Table rows={data.positions} getRowKey={(row: any, index) => row.id ?? row.symbol ?? index} columns={[{ key: 'symbol', label: 'Symbol' }, { key: 'quantity', label: 'Quantity' }, { key: 'avgBuyCost', label: 'Avg Buy' }, { key: 'marketPrice', label: 'Market Price' }, { key: 'unrealizedPnl', label: 'Unrealized P&L' }]} /></section>;
}

export function OrdersView({ data }: { data: DashboardData }) {
  return <section className="dashboard-data-section"><SectionHeader title="Orders" caption={`${data.orders.length} ${data.orders.length === 1 ? 'item' : 'items'}`} /><Table rows={data.orders} getRowKey={(row: any, index) => row.id ?? row.symbol ?? index} columns={[{ key: 'side', label: 'Side' }, { key: 'symbol', label: 'Symbol' }, { key: 'quantity', label: 'Quantity' }, { key: 'price', label: 'Price' }, { key: 'status', label: 'Status' }, { key: 'fee', label: 'Fee' }, { key: 'tax', label: 'Tax' }]} /></section>;
}

export function SettingsView() {
  return <div className="dashboard-view dashboard-view-settings"><div className="settings-grid-intro"><p className="eyebrow">Workspace</p><h1>Settings</h1><p className="page-subtitle">Manage platform connections and environments.</p></div><div className="settings-grid-items"><PlatformConfigTab /></div></div>;
}

function Panel({ title, caption, icon: Icon, action, children }: { title: string; caption: string; icon: typeof Layers3; action?: () => void; children: React.ReactNode }) {
  return <Card className="panel-card"><div className="panel-head"><div className="flex min-w-0 items-center gap-3"><div className="panel-icon"><Icon className="size-4" /></div><div className="min-w-0"><h2>{title}</h2><p>{caption}</p></div></div>{action && <button type="button" className="panel-action" onClick={action}>View all <ChevronRight className="size-4" /></button>}</div><div className="panel-body">{children}</div></Card>;
}

function AssetList({ rows, kind = 'default', onTrade, onPromote, promoteBusy }: { rows: any[]; kind?: 'default' | 'pool' | 'candidate'; onTrade?: (row: any) => void; onPromote?: (row: any) => void; promoteBusy?: string | null; }) {
  if (!rows.length) return <Empty kind={kind} />;
  const items = rows.slice(0, 4).map((row, i) => {
    const symbol = String(row.symbol ?? row.code ?? row.name ?? `Item ${i + 1}`);
    const isPool = kind === 'pool'; const isCandidate = kind === 'candidate';
    const rank = row.rank == null ? null : Number(row.rank); const score = row.score == null ? null : Number(row.score);
    const currentPrice = row.currentPrice ?? row.current_price; const targetPrice = row.targetPrice ?? row.target_price;
    const entryLow = row.entryLow ?? row.entry_low; const entryHigh = row.entryHigh ?? row.entry_high;
    const quantity = row.quantity ?? row.targetQuantity ?? row.target_quantity ?? row.total;
    const primaryValue = isPool && currentPrice != null ? formatNumber(currentPrice) : isCandidate && targetPrice != null ? `TP ${formatNumber(targetPrice)}` : isPool && entryLow != null && entryHigh != null ? `${formatNumber(entryLow)}–${formatNumber(entryHigh)}` : money(row.marketValue ?? row.market_value ?? row.price);
    const secondary = isPool ? `#${rank ?? '—'} · ${score == null ? '—' : formatNumber(score)} · ${String(row.status ?? 'WATCHING')}` : isCandidate ? `#${rank ?? '—'} · ${String(row.status ?? 'CANDIDATE')}` : `${formatNumber(quantity ?? 0)} units · ${String(row.status ?? 'OPEN')}`;
    return { id: row.id ?? row.symbol ?? row.code ?? i, title: symbol, description: secondary, trailing: <span className="asset-value">{primaryValue}</span> };
  });
  const actionable = items.map((item, index) => ({ ...item, trailing: <div className="asset-actions flex items-center gap-2">{item.trailing}{kind === 'candidate' && onTrade ? <button type="button" className="primary-action" onClick={() => onTrade(rows[index])}>Create order</button> : null}{kind === 'pool' && onTrade ? <button type="button" className="panel-action" onClick={() => onTrade(rows[index])}>Trade</button> : null}{kind === 'pool' && onPromote && rows[index]?.id ? <button type="button" className="panel-action" onClick={() => onPromote(rows[index])} disabled={promoteBusy === String(rows[index].id)}>{promoteBusy === String(rows[index].id) ? '…' : 'Promote'}</button> : null}</div> }));
  return <ListView items={actionable} />;
}

function SectionHeader({ title, caption }: { title: string; caption: string }) { return <div className="section-header"><h2>{title}</h2><span>{caption}</span></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="metric-label">{label}</p><p className="metric-secondary">{value}</p></div>; }
function Empty({ kind }: { kind: 'default' | 'pool' | 'candidate' }) { const message = kind === 'pool' ? 'No shared pool items' : kind === 'candidate' ? 'No candidates yet' : 'No data yet'; return <div className="empty-state">{message}</div>; }
function money(value: any) { const numeric = Number(value); return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric) : '—'; }
function formatNumber(value: any) { const numeric = Number(value); return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric) : '—'; }

export function TradeTicket({ pool, busy, error, onClose, onSubmit }: { pool: any; busy: boolean; error: string; onClose: () => void; onSubmit: (payload: TradePayload) => void; }) {
  const [side, setSide] = useState<'BUY' | 'SELL'>((pool?.side ?? 'BUY') as 'BUY' | 'SELL');
  const [quantity, setQuantity] = useState(String(pool?.quantity ?? pool?.targetQuantity ?? pool?.target_quantity ?? 100));
  const [orderType, setOrderType] = useState<TradePayload['orderType']>('LO');
  const [price, setPrice] = useState(String(pool?.currentPrice ?? pool?.current_price ?? ''));
  const numericQuantity = Number(quantity); const numericPrice = Number(price); const isNextPosition = pool?.__orderSource === 'next-position';
  return <div className="trade-overlay" role="dialog" aria-modal="true"><Card className="trade-ticket"><div className="panel-head"><div><h2>{isNextPosition ? 'Create order' : 'Trade'} {String(pool?.symbol ?? pool?.code ?? 'asset').toUpperCase()}</h2><p>{isNextPosition ? 'Create SSI buy order from Next Position' : 'SSI order'}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close trade ticket" disabled={busy}><X className="size-4" /></button></div><div className="trade-controls"><div className="trade-side-toggle"><button type="button" className={side === 'BUY' ? 'active' : ''} onClick={() => setSide('BUY')} disabled={busy || isNextPosition}>BUY</button><button type="button" className={side === 'SELL' ? 'active' : ''} onClick={() => setSide('SELL')} disabled={busy || isNextPosition}>SELL</button></div><label>Quantity<input inputMode="numeric" value={quantity} onChange={event => setQuantity(event.target.value)} disabled={busy} /></label><label>Order type<select value={orderType} onChange={event => setOrderType(event.target.value as TradePayload['orderType'])} disabled={busy}><option value="LO">LO</option><option value="MTL">MTL</option><option value="MP">MP</option><option value="ATO">ATO</option><option value="ATC">ATC</option><option value="MOK">MOK</option><option value="MAK">MAK</option><option value="PLO">PLO</option></select></label>{orderType === 'LO' && <label>Price<input inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} disabled={busy} /></label>}</div><Button type="button" onClick={() => onSubmit({ side, quantity: numericQuantity, orderType, price: orderType === 'LO' ? numericPrice : undefined })} disabled={busy || !Number.isFinite(numericQuantity) || numericQuantity <= 0 || (orderType === 'LO' && (!Number.isFinite(numericPrice) || numericPrice <= 0))}>{busy ? 'Submitting…' : 'Place order'}</Button>{error && <div className="error-banner">{error}</div>}</Card></div>;
}
