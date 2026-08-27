import { USDMClient } from 'binance';
import { getBinanceFuturesUrl, BinanceFuturesEnvironment } from './binance.constants';

type BinanceCredentials = { apiKey?: string; apiSecret?: string };

export type BinancePosition = {
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  markPrice: number;
  unrealizedProfit: number;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
};

export type BinanceOpenOrder = {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  status: string;
  side: 'BUY' | 'SELL';
  type: string;
  origQty: number;
  price?: number;
  stopPrice?: number;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
  reduceOnly?: boolean;
};

export class BinanceFuturesStateAdapter {
  private readonly client: USDMClient;

  constructor(private readonly credentials: BinanceCredentials, private readonly environment: BinanceFuturesEnvironment = 'production') {
    getBinanceFuturesUrl(environment);
    this.client = new USDMClient({ api_key: credentials.apiKey, api_secret: credentials.apiSecret, testnet: environment === 'testnet' });
  }

  private assertCredentials() {
    if (!this.credentials.apiKey || !this.credentials.apiSecret) throw new Error('Binance API credentials are not configured');
  }

  async positions(symbol?: string): Promise<BinancePosition[]> {
    this.assertCredentials();
    const rows = await this.client.getPositions({ symbol: symbol?.toUpperCase() });
    return rows.map((row) => ({
      symbol: String(row.symbol),
      positionAmt: Number(row.positionAmt ?? 0),
      entryPrice: Number(row.entryPrice ?? 0),
      markPrice: Number(row.markPrice ?? 0),
      unrealizedProfit: Number(row.unRealizedProfit ?? row.unrealizedProfit ?? 0),
      positionSide: row.positionSide as BinancePosition['positionSide'],
    }));
  }

  async openOrders(symbol?: string): Promise<BinanceOpenOrder[]> {
    this.assertCredentials();
    const rows = await this.client.getAllOpenOrders({ symbol: symbol?.toUpperCase() });
    return rows.map((row) => ({
      orderId: String(row.orderId),
      clientOrderId: typeof row.clientOrderId === 'string' ? row.clientOrderId : undefined,
      symbol: String(row.symbol),
      status: String(row.status),
      side: row.side as BinanceOpenOrder['side'],
      type: String(row.type),
      origQty: Number(row.origQty ?? 0),
      price: row.price == null ? undefined : Number(row.price),
      stopPrice: row.stopPrice == null ? undefined : Number(row.stopPrice),
      positionSide: row.positionSide as BinanceOpenOrder['positionSide'],
      reduceOnly: row.reduceOnly == null ? undefined : Boolean(row.reduceOnly),
    }));
  }

  async order(symbol: string, orderId: string) {
    this.assertCredentials();
    return this.client.getOrder({ symbol: symbol.toUpperCase(), orderId: Number(orderId) });
  }
}
