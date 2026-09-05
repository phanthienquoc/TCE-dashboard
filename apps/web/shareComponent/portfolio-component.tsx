'use client';

import { Card, CardContent } from '../components/ui/card';
import { AccountCard } from './account-card';

type PortfolioPosition = Record<string, any>;
type PortfolioAccount = Record<string, any>;

export interface PortfolioComponentProps {
  positions: PortfolioPosition[];
  accounts: PortfolioAccount[];
  portfolioValue?: number | null;
}

export function PortfolioComponent({
  positions,
  accounts,
  portfolioValue,
}: PortfolioComponentProps) {
  const totalInvest = positions.reduce((sum, row) => {
    const value =
      row.costBasis ??
      row.cost_basis ??
      Number(row.quantity ?? 0) * Number(row.avgBuyCost ?? row.avg_cost ?? 0);
    return sum + (Number.isFinite(Number(value)) ? Number(value) : 0);
  }, 0);

  const totalMarket = positions.reduce((sum, row) => {
    const value = row.marketValue ?? row.market_value;
    return sum + (Number.isFinite(Number(value)) ? Number(value) : 0);
  }, 0);

  const totalPnl = positions.reduce((sum, row) => {
    const value = row.unrealizedPnl ?? row.unrealized_pnl;
    return sum + (Number.isFinite(Number(value)) ? Number(value) : 0);
  }, 0);

  const calculatedPnl = totalMarket - totalInvest;
  const pnl = Number.isFinite(totalPnl) && totalPnl !== 0 ? totalPnl : calculatedPnl;
  const pnlPct = totalInvest ? (pnl / totalInvest) * 100 : null;

  return (
    <Card className="hero-card portfolio-overview-card">
      <CardContent className="p-4">
        <PortfolioValueCard value={money(portfolioValue ?? totalMarket)} />

        <div className="portfolio-metric-grid">
          <PortfolioMetricCard label="Invested" value={money(totalInvest)} />
          <PortfolioMetricCard label="Market Value" value={money(totalMarket)} />
          <PortfolioMetricCard
            label="Profit / Loss"
            value={signedMoney(pnl)}
            tone={pnl >= 0 ? 'positive' : 'negative'}
          />
          <PortfolioMetricCard
            label="% Profit / Loss"
            value={pnlPct == null ? '—' : `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`}
            tone={pnl >= 0 ? 'positive' : 'negative'}
          />
          <PortfolioMetricCard label="Positions" value={String(positions.length)} />
          <PortfolioMetricCard label="Accounts" value={String(accounts.length || '—')} />
        </div>

        {accounts.length > 0 && (
          <div className="portfolio-connected-account">
            {accounts.map((item, index) => (
              <PortfolioAccountCard
                key={item.id ?? item.accountNo ?? item.externalAccountNo ?? index}
                provider={String(item.provider ?? item.broker ?? 'Account')}
                identifier={String(
                  item.accountNo ?? item.externalAccountNo ?? item.environment ?? 'Connected'
                )}
                status={String(item.status ?? 'Connected')}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PortfolioValueCard({ value }: { value: string }) {
  return (
    <div className="portfolio-value-card">
      <div>
        <p className="metric-label">Total portfolio value</p>
        <p className="metric-value">{value}</p>
      </div>
      <div className="hero-status">LIVE</div>
    </div>
  );
}

export function PortfolioMetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <Card className={tone ? `portfolio-metric-card ${tone}` : 'portfolio-metric-card'}>
      <CardContent className="portfolio-metric-card-content">
        <span>{label}</span>
        <strong>{value}</strong>
      </CardContent>
    </Card>
  );
}

export function PortfolioAccountCard({
  provider,
  identifier,
  status,
}: {
  provider: string;
  identifier: string;
  status: string;
}) {
  return (
    <Card className="portfolio-account-card">
      <CardContent className="p-0">
        <AccountCard provider={provider} identifier={identifier} status={status} />
      </CardContent>
    </Card>
  );
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
