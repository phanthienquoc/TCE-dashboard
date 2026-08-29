import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BinanceFuturesService } from '../platform/binance-futures.service';
import { SupabaseClientService } from '../db/supabase.client';

const ACTIVE_STATUSES = ['QUEUED', 'ACCEPTED'] as const;
const PROTECTION_TYPES = new Set(['STOP', 'STOP_MARKET', 'TAKE_PROFIT', 'TAKE_PROFIT_MARKET']);
type SignalRow = {
  id: string;
  user_id: string;
  environment: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entry: number;
  tp: number;
  sl: number;
  status: string;
};
export type BinanceEngineConfig = {
  enabled: boolean;
  quantity: number;
  positionSide: 'BOTH' | 'LONG' | 'SHORT';
  scanIntervalMs: number;
};

@Injectable()
export class BinanceEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceEngineService.name);
  private timer?: ReturnType<typeof setInterval>;
  private readonly processing = new Set<string>();
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly binance: BinanceFuturesService
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => void this.scan(), 5000);
    void this.scan();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async getConfig(userId: string) {
    return this.config(userId);
  }
  async setConfig(userId: string, input: Partial<BinanceEngineConfig>) {
    const quantity = Number(input.quantity ?? 0);
    const positionSide =
      input.positionSide === 'LONG' || input.positionSide === 'SHORT' ? input.positionSide : 'BOTH';
    if (!Number.isFinite(quantity) || quantity <= 0)
      throw new Error('Binance order quantity must be greater than zero.');
    const payload = {
      account_id: userId,
      binance_engine_enabled: Boolean(input.enabled),
      binance_order_quantity: quantity,
      binance_position_side: positionSide,
      updated_at: new Date().toISOString(),
    };
    const { error } = await this.supabase.db
      .from('tce_strategy_config')
      .upsert(payload, { onConflict: 'account_id' });
    if (error) throw error;
    return {
      enabled: payload.binance_engine_enabled,
      quantity,
      positionSide,
      scanIntervalMs: 5000,
    };
  }
  async scan() {
    const { data, error } = await this.supabase.db
      .from('tce_telegram_signals')
      .select('id,user_id,environment,symbol,side,entry,tp,sl,status')
      .in('status', [...ACTIVE_STATUSES])
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) {
      this.logger.warn(`Binance signal scan failed: ${error.message}`);
      return;
    }
    for (const row of data ?? []) {
      const signal = row as SignalRow;
      const key = `${signal.user_id}:${signal.environment}:${signal.symbol}`;
      if (this.processing.has(key)) continue;
      this.processing.add(key);
      try {
        await this.process(signal);
      } catch (error) {
        this.logger.error(
          `${signal.symbol} ${signal.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        this.processing.delete(key);
      }
    }
  }
  private async config(userId: string): Promise<BinanceEngineConfig> {
    const { data, error } = await this.supabase.db
      .from('tce_strategy_config')
      .select('binance_engine_enabled,binance_order_quantity,binance_position_side')
      .eq('account_id', userId)
      .maybeSingle();
    if (error) throw error;
    return {
      enabled: Boolean(data?.binance_engine_enabled ?? false),
      quantity: Number(data?.binance_order_quantity ?? 0),
      positionSide:
        data?.binance_position_side === 'LONG' || data?.binance_position_side === 'SHORT'
          ? data.binance_position_side
          : 'BOTH',
      scanIntervalMs: 5000,
    };
  }
  private async process(signal: SignalRow) {
    const config = await this.config(signal.user_id);
    if (!config.enabled) return;
    if (!Number.isFinite(config.quantity) || config.quantity <= 0) {
      await this.fail(signal.id, 'Binance order quantity is not configured.');
      return;
    }
    const symbol = signal.symbol.toUpperCase();
    const positions = await this.binance.positions(signal.user_id, signal.environment, symbol);
    const position = positions.find(
      item => item.symbol === symbol && Math.abs(item.positionAmt) > 0
    );
    const openOrders = await this.binance.openOrders(signal.user_id, signal.environment, symbol);
    if (position) {
      await this.reconcileProtection(signal, position, openOrders, config);
      return;
    }
    const entryClientId = this.entryClientId(signal.id);
    const entry = openOrders.find(order => order.clientOrderId === entryClientId);
    if (entry) {
      const current = await this.binance.order(
        signal.user_id,
        signal.environment,
        symbol,
        entry.orderId
      );
      const status = String(current.status ?? entry.status);
      if (status === 'FILLED' || status === 'PARTIALLY_FILLED')
        await this.touchStatus(signal.id, 'ACCEPTED');
      else if (['CANCELED', 'EXPIRED', 'REJECTED'].includes(status))
        await this.fail(signal.id, `Binance entry order ${status}.`);
      return;
    }
    if (openOrders.some(order => !PROTECTION_TYPES.has(order.type))) {
      await this.fail(signal.id, `${symbol} already has an active Binance order.`);
      return;
    }
    const result = await this.binance.entry(
      signal.user_id,
      {
        symbol,
        side: signal.side,
        positionSide: config.positionSide,
        quantity: config.quantity,
        price: Number(signal.entry),
        timeInForce: 'GTC',
        reduceOnly: false,
        clientOrderId: entryClientId,
      },
      signal.environment
    );
    if (!result.ok) throw new Error(result.error.message);
    await this.touchStatus(signal.id, 'ACCEPTED');
  }
  private async reconcileProtection(
    signal: SignalRow,
    position: { positionAmt: number; positionSide?: 'BOTH' | 'LONG' | 'SHORT' },
    openOrders: Array<{
      type: string;
      side: 'BUY' | 'SELL';
      stopPrice?: number;
      positionSide?: string;
      clientOrderId?: string;
    }>,
    config: BinanceEngineConfig
  ) {
    const quantity = Math.abs(position.positionAmt);
    const exitSide = position.positionAmt > 0 ? 'SELL' : 'BUY';
    const positionSide = position.positionSide ?? config.positionSide;
    const hasTp = openOrders.some(
      order =>
        order.side === exitSide &&
        order.positionSide === positionSide &&
        (order.type === 'TAKE_PROFIT_MARKET' || order.type === 'TAKE_PROFIT') &&
        this.samePrice(order.stopPrice, Number(signal.tp))
    );
    const hasSl = openOrders.some(
      order =>
        order.side === exitSide &&
        order.positionSide === positionSide &&
        (order.type === 'STOP_MARKET' || order.type === 'STOP') &&
        this.samePrice(order.stopPrice, Number(signal.sl))
    );
    if (!hasSl) {
      const result = await this.binance.stopLoss(
        signal.user_id,
        {
          symbol: signal.symbol,
          side: exitSide,
          positionSide,
          quantity,
          triggerPrice: Number(signal.sl),
          reduceOnly: true,
          clientOrderId: this.slClientId(signal.id),
        },
        signal.environment
      );
      if (!result.ok) {
        await this.fail(signal.id, `Unable to create SL: ${result.error.message}`);
        return;
      }
    }
    const afterSl =
      hasSl ||
      (await this.binance.openOrders(signal.user_id, signal.environment, signal.symbol)).some(
        order => order.clientOrderId === this.slClientId(signal.id)
      );
    if (!afterSl) return;
    if (!hasTp) {
      const result = await this.binance.takeProfit(
        signal.user_id,
        {
          symbol: signal.symbol,
          side: exitSide,
          positionSide,
          quantity,
          triggerPrice: Number(signal.tp),
          reduceOnly: true,
          clientOrderId: this.tpClientId(signal.id),
        },
        signal.environment
      );
      if (!result.ok) {
        await this.fail(signal.id, `Unable to create TP: ${result.error.message}`);
        return;
      }
    }
    const verified = await this.binance.openOrders(
      signal.user_id,
      signal.environment,
      signal.symbol
    );
    if (
      verified.some(order => order.clientOrderId === this.tpClientId(signal.id)) &&
      verified.some(order => order.clientOrderId === this.slClientId(signal.id))
    )
      await this.touchStatus(signal.id, 'EXECUTED');
  }
  private samePrice(a: number | undefined, b: number) {
    return a != null && Number.isFinite(a) && Math.abs(a - b) < Math.max(1e-8, Math.abs(b) * 1e-8);
  }
  private entryClientId(id: string) {
    return `TCE-E-${id.replace(/-/g, '').slice(0, 24)}`;
  }
  private tpClientId(id: string) {
    return `TCE-TP-${id.replace(/-/g, '').slice(0, 23)}`;
  }
  private slClientId(id: string) {
    return `TCE-SL-${id.replace(/-/g, '').slice(0, 23)}`;
  }
  private async touchStatus(id: string, status: 'ACCEPTED' | 'EXECUTED') {
    const { error } = await this.supabase.db
      .from('tce_telegram_signals')
      .update({ status, updated_at: new Date().toISOString(), error_message: null })
      .eq('id', id);
    if (error) throw error;
  }
  private async fail(id: string, message: string) {
    const { error } = await this.supabase.db
      .from('tce_telegram_signals')
      .update({ status: 'FAILED', error_message: message, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }
}
