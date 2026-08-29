import { USDMClient } from 'binance';
import {
  ContractResult,
  FuturesCancelOrderInput,
  FuturesCancelOrderResult,
  FuturesEntryOrderInput,
  FuturesExecutionPort,
  FuturesOrderResult,
  FuturesTpSlInput,
} from '@tce/contracts';
import { getBinanceFuturesUrl, BinanceFuturesEnvironment } from './binance.constants';

type BinanceCredentials = { apiKey?: string; apiSecret?: string };
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
type BinanceCancelResponse = {
  orderId: number;
  clientOrderId?: string;
  symbol: string;
  status: string;
};

const boolString = (value: boolean | undefined) =>
  value === undefined ? undefined : value ? 'true' : 'false';

export class BinanceFuturesExecutionAdapter implements FuturesExecutionPort {
  readonly provider = 'binance' as const;
  private readonly client: USDMClient;
  private readonly environment: BinanceFuturesEnvironment;

  constructor(
    private readonly credentials: BinanceCredentials,
    environment: BinanceFuturesEnvironment = 'production'
  ) {
    this.environment = environment;
    getBinanceFuturesUrl(environment);
    this.client = new USDMClient({
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      testnet: environment === 'testnet',
    });
  }

  private result<T>(data: T): ContractResult<T> {
    return { ok: true, data };
  }

  private fail(error: unknown): ContractResult<never> {
    const candidate =
      error && typeof error === 'object' ? (error as Record<string, unknown>) : undefined;
    const response =
      candidate?.response && typeof candidate.response === 'object'
        ? (candidate.response as Record<string, unknown>)
        : undefined;
    const payload =
      response?.data && typeof response.data === 'object'
        ? (response.data as Record<string, unknown>)
        : candidate?.data && typeof candidate.data === 'object'
          ? (candidate.data as Record<string, unknown>)
          : candidate;
    const message =
      typeof payload?.msg === 'string'
        ? payload.msg
        : typeof payload?.message === 'string'
          ? payload.message
          : typeof candidate?.message === 'string'
            ? candidate.message
            : error instanceof Error
              ? error.message
              : String(error);
    const details: Record<string, unknown> = {};
    const providerCode = payload?.code;
    const httpStatus = response?.status ?? candidate?.status;
    if (typeof providerCode === 'number' || typeof providerCode === 'string')
      details.providerCode = providerCode;
    if (typeof httpStatus === 'number') details.httpStatus = httpStatus;
    return {
      ok: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: message || 'Binance provider request failed',
        retryable: false,
        provider: 'binance',
        ...(Object.keys(details).length ? { details } : {}),
      },
    };
  }

  private missingCredentials(): ContractResult<never> | null {
    if (!this.credentials.apiKey || !this.credentials.apiSecret)
      return {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Binance API credentials are not configured',
          retryable: false,
          provider: 'binance',
        },
      };
    return null;
  }

  async testConnection(): Promise<
    ContractResult<{
      connected: boolean;
      environment: BinanceFuturesEnvironment;
      balances: unknown[];
    }>
  > {
    const missing = this.missingCredentials();
    if (missing) return missing;
    try {
      const balances = (await this.client.getBalance()) as unknown[];
      return this.result({ connected: true, environment: this.environment, balances });
    } catch (error) {
      return this.fail(error);
    }
  }

  private async order(
    params: Parameters<USDMClient['submitNewOrder']>[0]
  ): Promise<ContractResult<FuturesOrderResult>> {
    const missing = this.missingCredentials();
    if (missing) return missing;
    try {
      const data = (await this.client.submitNewOrder(params)) as BinanceOrderResponse;
      return this.result({
        orderId: String(data.orderId),
        clientOrderId: data.clientOrderId,
        symbol: data.symbol,
        status: data.status,
        side: data.side,
        type: data.type,
        quantity: Number(data.origQty ?? 0),
        price: data.price !== undefined ? Number(data.price) : undefined,
        triggerPrice: data.stopPrice !== undefined ? Number(data.stopPrice) : undefined,
        positionSide: data.positionSide,
        source: 'binance',
      });
    } catch (error) {
      return this.fail(error);
    }
  }

  placeEntry(input: FuturesEntryOrderInput) {
    const type =
      input.triggerPrice !== undefined
        ? input.price !== undefined
          ? 'STOP'
          : 'STOP_MARKET'
        : input.price !== undefined
          ? 'LIMIT'
          : 'MARKET';
    return this.order({
      symbol: input.symbol.toUpperCase(),
      side: input.side,
      positionSide: input.positionSide,
      type,
      quantity: input.quantity,
      price: input.price,
      stopPrice: input.triggerPrice,
      reduceOnly: boolString(input.reduceOnly ?? false),
      newClientOrderId: input.clientOrderId,
      timeInForce: input.price !== undefined ? (input.timeInForce ?? 'GTC') : undefined,
    });
  }

  placeTakeProfit(input: FuturesTpSlInput) {
    const type = input.limitPrice !== undefined ? 'TAKE_PROFIT' : 'TAKE_PROFIT_MARKET';
    return this.order({
      symbol: input.symbol.toUpperCase(),
      side: input.side,
      positionSide: input.positionSide,
      type,
      quantity: type === 'TAKE_PROFIT' ? input.quantity : undefined,
      price: input.limitPrice,
      stopPrice: input.triggerPrice,
      reduceOnly: boolString(input.reduceOnly ?? true),
      newClientOrderId: input.clientOrderId,
      timeInForce: input.limitPrice !== undefined ? 'GTC' : undefined,
    });
  }

  placeStopLoss(input: FuturesTpSlInput) {
    const type = input.limitPrice !== undefined ? 'STOP' : 'STOP_MARKET';
    return this.order({
      symbol: input.symbol.toUpperCase(),
      side: input.side,
      positionSide: input.positionSide,
      type,
      quantity: type === 'STOP' ? input.quantity : undefined,
      price: input.limitPrice,
      stopPrice: input.triggerPrice,
      reduceOnly: boolString(input.reduceOnly ?? true),
      newClientOrderId: input.clientOrderId,
      timeInForce: input.limitPrice !== undefined ? 'GTC' : undefined,
    });
  }

  async cancelOrder(
    input: FuturesCancelOrderInput
  ): Promise<ContractResult<FuturesCancelOrderResult>> {
    const missing = this.missingCredentials();
    if (missing) return missing;
    const symbol = String(input.symbol ?? '')
      .trim()
      .toUpperCase();
    if (!symbol)
      return {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Binance symbol is required to cancel an order',
          retryable: false,
          provider: 'binance',
        },
      };
    if (input.orderId == null && !String(input.clientOrderId ?? '').trim())
      return {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Binance orderId or clientOrderId is required',
          retryable: false,
          provider: 'binance',
        },
      };
    let numericOrderId: number | undefined;
    if (input.orderId != null) {
      numericOrderId = Number(input.orderId);
      if (!Number.isSafeInteger(numericOrderId) || numericOrderId <= 0)
        return {
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Binance orderId must be a positive integer',
            retryable: false,
            provider: 'binance',
          },
        };
    }
    try {
      const data = (await this.client.cancelOrder({
        symbol,
        orderId: numericOrderId,
        origClientOrderId: input.clientOrderId,
      })) as BinanceCancelResponse;
      return this.result({
        orderId: String(data.orderId),
        clientOrderId: data.clientOrderId,
        symbol: data.symbol,
        status: data.status,
        source: 'binance',
      });
    } catch (error) {
      return this.fail(error);
    }
  }
}
