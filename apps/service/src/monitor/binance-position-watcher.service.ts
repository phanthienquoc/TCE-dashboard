import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BinanceFuturesService } from '../platform/binance-futures.service';
import { SupabaseClientService } from '../db/supabase.client';
import { BinanceEngineService } from './binance-engine.service';

/**
 * Reconciliation layer for Binance Futures positions.
 * The Binance SDK used by this repo exposes account state over REST but does not
 * currently expose a user-data websocket abstraction. Keep a dedicated watcher
 * so execution logic can react independently and switch to a native socket later.
 */
@Injectable()
export class BinancePositionWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinancePositionWatcherService.name);
  private timer?: ReturnType<typeof setInterval>;
  private lastFingerprint = new Map<string, string>();

  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly binance: BinanceFuturesService,
    private readonly engine: BinanceEngineService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.poll(), 1500);
    void this.poll();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll() {
    try {
      const { data, error } = await this.supabase.db
        .from('tce_strategy_config')
        .select('account_id,binance_engine_enabled,binance_xau_enabled,binance_xau_symbol')
        .eq('binance_engine_enabled', true)
        .eq('binance_xau_enabled', true);
      if (error) throw error;
      for (const config of data ?? []) {
        const userId = String(config.account_id);
        const symbol = String(config.binance_xau_symbol ?? 'XAUUSDT').toUpperCase();
        for (const environment of ['production', 'testnet']) {
          try {
            const positions = await this.binance.positions(userId, environment, symbol);
            const active = positions.filter(item => Math.abs(item.positionAmt) > 0);
            const fingerprint = JSON.stringify(
              active.map(item => [item.symbol, item.positionAmt, item.entryPrice, item.markPrice])
            );
            const key = `${userId}:${environment}:${symbol}`;
            if (this.lastFingerprint.get(key) !== fingerprint) {
              this.lastFingerprint.set(key, fingerprint);
              await this.engine.scan();
            }
          } catch (error) {
            this.logger.debug(
              `Position watcher ${userId}/${environment}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `Binance position watcher failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
