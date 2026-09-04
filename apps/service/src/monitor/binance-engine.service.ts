import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BinanceFuturesService } from '../platform/binance-futures.service';
import { SupabaseClientService } from '../db/supabase.client';
import type { BinanceFuturesUserDataEvent } from '@tce/binance';

const ACTIVE_STATUSES = ['QUEUED', 'ACCEPTED'] as const;
const PROTECTION_TYPES = new Set(['STOP', 'STOP_MARKET', 'TAKE_PROFIT', 'TAKE_PROFIT_MARKET']);
const DEFAULT_SYMBOL = 'XAUUSDT';
const DEFAULT_TP_SL_PCT = 5;

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
  xauEnabled: boolean;
  xauSymbol: string;
  autoProtection: boolean;
  tpPct: number;
  slPct: number;
};

@Injectable()
export class BinanceEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceEngineService.name);
  private timer?: ReturnType<typeof setInterval>;
  private readonly processing = new Set<string>();
  private readonly streams = new Map<
    string,
    { stop: () => Promise<void>; unsubscribe: () => boolean }
  >();

  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly binance: BinanceFuturesService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.scan(), 5000);
    void this.scan();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await Promise.all([...this.streams.values()].map(stream => stream.stop()));
    this.streams.clear();
  }

  async getConfig(userId: string) {
    return this.config(userId);
  }

  async getLivePosition(userId: string, environment = 'production') {
    return this.binance.positions(userId, environment, DEFAULT_SYMBOL);
  }

  async openOrdersForSymbol(userId: string, environment = 'production', symbol = DEFAULT_SYMBOL) {
    return this.binance.openOrders(userId, environment, symbol);
  }

  async setConfig(userId: string, input: Partial<BinanceEngineConfig>) {
    const quantity = Number(input.quantity ?? 0);
    const positionSide =
      input.positionSide === 'LONG' || input.positionSide === 'SHORT' ? input.positionSide : 'BOTH';
    if (!Number.isFinite(quantity) || quantity <= 0)
      throw new Error('Binance order quantity must be greater than zero.');
    const tpPct = Number(input.tpPct ?? DEFAULT_TP_SL_PCT),
      slPct = Number(input.slPct ?? DEFAULT_TP_SL_PCT);
    if (![tpPct, slPct].every(value => Number.isFinite(value) && value > 0))
      throw new Error('XAU TP/SL percentages must be greater than zero.');
    const xauSymbol =
      String(input.xauSymbol ?? DEFAULT_SYMBOL)
        .trim()
        .toUpperCase() || DEFAULT_SYMBOL;
    const payload = {
      account_id: userId,
      binance_engine_enabled: Boolean(input.enabled),
      binance_order_quantity: quantity,
      binance_position_side: positionSide,
      binance_xau_enabled: Boolean(input.xauEnabled ?? input.enabled),
      binance_xau_symbol: xauSymbol,
      binance_xau_tp_pct: tpPct,
      binance_xau_sl_pct: slPct,
      binance_xau_auto_protection: Boolean(input.autoProtection ?? true),
      updated_at: new Date().toISOString(),
    };
    const { error } = await this.supabase.db
      .from('tce_strategy_config')
      .upsert(payload, { onConflict: 'account_id' });
    if (error) throw error;
    if (payload.binance_engine_enabled && payload.binance_xau_enabled)
      await this.ensureStream(userId, 'production');
    return {
      enabled: payload.binance_engine_enabled,
      quantity,
      positionSide,
      scanIntervalMs: 5000,
      xauEnabled: payload.binance_xau_enabled,
      xauSymbol,
      autoProtection: payload.binance_xau_auto_protection,
      tpPct,
      slPct,
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
        await this.ensureStream(signal.user_id, signal.environment);
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

  private async ensureStream(userId: string, environment: string) {
    const key = `${userId}:${environment}`;
    if (this.streams.has(key)) return;
    const stream = await this.binance.userDataStream(userId, environment);
    const unsubscribe = stream.on((event: BinanceFuturesUserDataEvent) => {
      if (
        event.e === 'ACCOUNT_UPDATE' ||
        event.e === 'ORDER_TRADE_UPDATE' ||
        event.e === 'listenKeyExpired'
      )
        void this.scan();
    });
    this.streams.set(key, { stop: () => stream.stop(), unsubscribe });
    try {
      await stream.start();
    } catch (error) {
      unsubscribe();
      this.streams.delete(key);
      await stream.stop();
      throw error;
    }
  }

  private async config(userId: string): Promise<BinanceEngineConfig> {
    const { data, error } = await this.supabase.db
      .from('tce_strategy_config')
      .select(
        'binance_engine_enabled,binance_order_quantity,binance_position_side,binance_xau_enabled,binance_xau_symbol,binance_xau_tp_pct,binance_xau_sl_pct,binance_xau_auto_protection'
      )
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
      xauEnabled: Boolean(data?.binance_xau_enabled ?? data?.binance_engine_enabled ?? false),
      xauSymbol:
        String(data?.binance_xau_symbol ?? DEFAULT_SYMBOL)
          .trim()
          .toUpperCase() || DEFAULT_SYMBOL,
      autoProtection: Boolean(data?.binance_xau_auto_protection ?? true),
      tpPct: Number(data?.binance_xau_tp_pct ?? DEFAULT_TP_SL_PCT),
      slPct: Number(data?.binance_xau_sl_pct ?? DEFAULT_TP_SL_PCT),
    };
  }

  private async process(signal: SignalRow) {
    const config = await this.config(signal.user_id);
    if (!config.enabled || !config.xauEnabled) return;
    if (!Number.isFinite(config.quantity) || config.quantity <= 0)
      return this.fail(signal.id, 'Binance order quantity is not configured.');
    const symbol = signal.symbol.toUpperCase();
    if (symbol !== config.xauSymbol)
      return this.fail(signal.id, `${symbol} is not enabled for the XAU futures engine.`);
    const positions = await this.binance.positions(signal.user_id, signal.environment, symbol);
    const position = positions.find(
      item => item.symbol === symbol && Math.abs(item.positionAmt) > 0
    );
    const openOrders = await this.binance.openOrders(signal.user_id, signal.environment, symbol);
    if (position) {
      if (config.autoProtection)
        await this.reconcileProtection(signal, position, openOrders, config);
      else await this.touchStatus(signal.id, 'EXECUTED');
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
    if (openOrders.some(order => !PROTECTION_TYPES.has(order.type)))
      return this.fail(signal.id, `${symbol} already has an active Binance order.`);
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
    position: {
      positionAmt: number;
      entryPrice?: number;
      positionSide?: 'BOTH' | 'LONG' | 'SHORT';
    },
    openOrders: Array<{
      type: string;
      side: 'BUY' | 'SELL';
      stopPrice?: number;
      positionSide?: string;
      clientOrderId?: string;
    }>,
    config: BinanceEngineConfig
  ) {
    const quantity = Math.abs(position.positionAmt),
      exitSide = position.positionAmt > 0 ? 'SELL' : 'BUY',
      positionSide = position.positionSide ?? config.positionSide,
      entryPrice = Number(position.entryPrice ?? signal.entry),
      isLong = position.positionAmt > 0;
    const desiredTp = this.percentPrice(entryPrice, isLong ? config.tpPct : -config.tpPct),
      desiredSl = this.percentPrice(entryPrice, isLong ? -config.slPct : config.slPct);
    const targetTp = this.validProtection(signal, isLong) ? Number(signal.tp) : desiredTp,
      targetSl = this.validProtection(signal, isLong) ? Number(signal.sl) : desiredSl;
    const hasTp = openOrders.some(
      order =>
        order.side === exitSide &&
        order.positionSide === positionSide &&
        (order.type === 'TAKE_PROFIT_MARKET' || order.type === 'TAKE_PROFIT') &&
        this.samePrice(order.stopPrice, targetTp)
    );
    const hasSl = openOrders.some(
      order =>
        order.side === exitSide &&
        order.positionSide === positionSide &&
        (order.type === 'STOP_MARKET' || order.type === 'STOP') &&
        this.samePrice(order.stopPrice, targetSl)
    );
    if (!hasSl) {
      const result = await this.binance.stopLoss(
        signal.user_id,
        {
          symbol: signal.symbol,
          side: exitSide,
          positionSide,
          quantity,
          triggerPrice: targetSl,
          reduceOnly: true,
          clientOrderId: this.slClientId(signal.id),
        },
        signal.environment
      );
      if (!result.ok) return this.fail(signal.id, `Unable to create SL: ${result.error.message}`);
    }
    if (!hasTp) {
      const result = await this.binance.takeProfit(
        signal.user_id,
        {
          symbol: signal.symbol,
          side: exitSide,
          positionSide,
          quantity,
          triggerPrice: targetTp,
          reduceOnly: true,
          clientOrderId: this.tpClientId(signal.id),
        },
        signal.environment
      );
      if (!result.ok) return this.fail(signal.id, `Unable to create TP: ${result.error.message}`);
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

  private validProtection(signal: SignalRow, isLong: boolean) {
    if (
      ![signal.entry, signal.tp, signal.sl].every(
        value => Number.isFinite(Number(value)) && Number(value) > 0
      )
    )
      return false;
    return isLong
      ? signal.sl < signal.entry && signal.entry < signal.tp
      : signal.tp < signal.entry && signal.entry < signal.sl;
  }
  private percentPrice(base: number, pct: number) {
    return Number((base * (1 + pct / 100)).toFixed(2));
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
