import { AccountOrder, AccountPosition, MarketQuote, OrderRepository, PositionRepository, MarketDataService, PortfolioService } from '@tce/contracts';

export class TceApplication implements PortfolioService, MarketDataService {
  constructor(private readonly positionsRepo: PositionRepository, private readonly ordersRepo: OrderRepository, private readonly market: MarketDataService) {}
  positions(accountId: string): Promise<AccountPosition[]> { return this.positionsRepo.listOpen(accountId); }
  orders(accountId: string): Promise<AccountOrder[]> { return this.ordersRepo.list(accountId); }
  quote(symbol: string): Promise<MarketQuote> { return this.market.quote(symbol); }
}
