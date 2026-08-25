import { USDMClient } from 'binance';
import { ContractResult, FuturesEntryOrderInput, FuturesExecutionPort, FuturesOrderResult, FuturesTpSlInput } from '@tce/contracts';

type BinanceCredentials = { apiKey?: string; apiSecret?: string; baseUrl?: string };
type BinanceOrderResponse = {
  orderId: number;
  clientOrderId?: string;
  symbol: string;
  status: string;
  side: 'BUY' | 'SELL';
  type: FuturesOrderResult['type'];
  origQty?: string;
  price?: string;
  stopPrice?: string;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
};

const boolString = (value: boolean | undefined) => value === undefined ? undefined : value ? 'true' : 'false';

export class BinanceFuturesExecutionAdapter implements FuturesExecutionPort {
  readonly provider = 'binance' as const;
  private readonly client: USDMClient;

  constructor(private readonly credentials: BinanceCredentials) {
    this.client = new USDMClient({
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      testnet: credentials.baseUrl?.includes('testnet') ?? false,
    });
  }

  private result<T>(data: T): ContractResult<T> { return { ok: true, data }; }

  private fail(error: unknown): ContractResult<never> {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { code: 'PROVIDER_ERROR', message, retryable: false, provider: 'binance' } };
  }

  async testConnection(): Promise<ContractResult<{ connected: boolean; environment: 'testnet' | 'production'; balances: unknown[] }>> {
    try {
      if (!this.credentials.apiKey || !this.credentials.apiSecret) {
        return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Binance API credentials are not configured', retryable: false, provider: 'binance' } };
      }
      const balances = await this.client.getBalance() as unknown[];
      return this.result({ connected: true, environment: this.credentials.baseUrl?.includes('testnet') ? 'testnet' : 'production', balances });
    } catch (error) { return this.fail(error); }
  }

  private async order(params: Parameters<USDMClient['submitNewOrder']>[0]): Promise<ContractResult<FuturesOrderResult>> {
    try {
      if (!this.credentials.apiKey || !this.credentials.apiSecret) {
        return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Binance API credentials are not configured', retryable: false, provider: 'binance' } };
      }
      const data = await this.client.submitNewOrder(params) as BinanceOrderResponse;
      return this.result({
        orderId: String(data.orderId), clientOrderId: data.clientOrderId, symbol: data.symbol, status: data.status,
        side: data.side, type: data.type, quantity: Number(data.origQty ?? 0),
        price: data.price !== undefined ? Number(data.price) : undefined,
        triggerPrice: data.stopPrice !== undefined ? Number(data.stopPrice) : undefined,
        positionSide: data.positionSide, source: 'binance',
      });
    } catch (error) { return this.fail(error); }
  }

  placeEntry(input: FuturesEntryOrderInput) {
    const type = input.triggerPrice !== undefined ? (input.price !== undefined ? 'STOP' : 'STOP_MARKET') : (input.price !== undefined ? 'LIMIT' : 'MARKET');
    return this.order({ symbol: input.symbol.toUpperCase(), side: input.side, positionSide: input.positionSide, type,
      quantity: input.quantity, price: input.price, stopPrice: input.triggerPrice, reduceOnly: boolString(input.reduceOnly ?? false),
      newClientOrderId: input.clientOrderId, timeInForce: input.price !== undefined ? (input.timeInForce ?? 'GTC') : undefined });
  }

  placeTakeProfit(input: FuturesTpSlInput) {
    const type = input.limitPrice !== undefined ? 'TAKE_PROFIT' : 'TAKE_PROFIT_MARKET';
    return this.order({ symbol: input.symbol.toUpperCase(), side: input.side, positionSide: input.positionSide, type,
      quantity: type === 'TAKE_PROFIT' ? input.quantity : undefined, price: input.limitPrice, stopPrice: input.triggerPrice,
      reduceOnly: boolString(input.reduceOnly ?? true), newClientOrderId: input.clientOrderId, timeInForce: input.limitPrice !== undefined ? 'GTC' : undefined });
  }

  placeStopLoss(input: FuturesTpSlInput) {
    const type = input.limitPrice !== undefined ? 'STOP' : 'STOP_MARKET';
    return this.order({ symbol: input.symbol.toUpperCase(), side: input.side, positionSide: input.positionSide, type,
      quantity: type === 'STOP' ? input.quantity : undefined, price: input.limitPrice, stopPrice: input.triggerPrice,
      reduceOnly: boolString(input.reduceOnly ?? true), newClientOrderId: input.clientOrderId, timeInForce: input.limitPrice !== undefined ? 'GTC' : undefined });
  }
}
