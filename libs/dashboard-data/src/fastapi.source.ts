import { ContractResult, DashboardSourcePort, MarketProviderPort } from '@tce/contracts';

export class FastApiDashboardSource implements DashboardSourcePort {
  readonly source = 'fastapi';
  constructor(
    private readonly market: MarketProviderPort,
    private readonly symbols: string[] = []
  ) {}
  async snapshot(_userId: string): Promise<ContractResult<unknown>> {
    const quotes = await Promise.all(this.symbols.map(symbol => this.market.quote(symbol)));
    const failed = quotes.find(q => !q.ok);
    if (failed) return failed;
    return { ok: true, data: { quotes: quotes.map(q => (q.ok ? q.data : null)).filter(Boolean) } };
  }
}
