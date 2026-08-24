import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
const INTERVAL_MS = 60 * 60 * 1000;

type Position = {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  avg_cost: number;
  cost_basis: number;
  market_price: number | null;
  market_value: number | null;
  unrealized_pnl: number | null;
  status: string;
  cycle_no: number | null;
};

@Injectable()
export class TceMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TceMonitorService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly supabase: SupabaseClientService) {}

  onModuleInit() {
    const delay = this.msToNextHour();
    this.timer = setTimeout(() => {
      void this.run();
      this.timer = setInterval(() => void this.run(), INTERVAL_MS);
    }, delay);
    this.logger.log(`TCE monitor scheduled; first run in ${Math.round(delay / 1000)}s`);
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<{ skipped: boolean; reason?: string; monitored: number; signals: string[] }> {
    if (this.running) return { skipped: true, reason: 'already_running', monitored: 0, signals: [] };
    this.running = true;
    const started = new Date().toISOString();
    const result = { skipped: false, monitored: 0, signals: [] as string[] };

    try {
      const { data: configs, error: configError } = await this.supabase.db
        .from('tce_strategy_config')
        .select('account_id,max_positions,pool_size,monitor_interval_minutes,market_open,market_close,timezone');
      if (configError) throw configError;

      for (const config of configs ?? []) {
        const timezone = this.safeTimezone(config.timezone);
        const inSession = this.isMarketSession(timezone);

        const { count: activeCount, error: countError } = await this.supabase.db
          .from('tce_positions')
          .select('symbol', { count: 'exact', head: true })
          .eq('account_id', config.account_id)
          .neq('status', 'CLOSED');
        if (countError) throw countError;

        if (!inSession) {
          await this.audit(config.account_id, 'POSITION_MONITOR', started, {
            market_session: false,
            active_position_count: activeCount ?? 0,
            skipped: true,
            skip_reason: 'outside_market_session',
          });
          continue;
        }

        const { data: positions, error: positionError } = await this.supabase.db
          .from('tce_positions')
          .select('id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status,cycle_no')
          .eq('account_id', config.account_id)
          .neq('status', 'CLOSED')
          .order('symbol');
        if (positionError) throw positionError;

        let accountSignals = 0;
        let accountMonitored = 0;

        for (const position of (positions ?? []) as Position[]) {
          const snapshot = this.buildSnapshot(position, true);
          const { data: inserted, error: snapshotError } = await this.supabase.db
            .from('tce_position_snapshots')
            .insert(snapshot)
            .select('id')
            .single();
          if (snapshotError) throw snapshotError;

          accountMonitored += 1;
          result.monitored += 1;
          if (snapshot.signal !== 'HOLD') {
            accountSignals += 1;
            result.signals.push(`${position.symbol}:${snapshot.signal}`);
          }

          if (snapshot.signal === 'CASHOUT' && inserted?.id) {
            const { error: cashoutError } = await this.supabase.db.from('tce_cashout_events').insert({
              account_id: config.account_id,
              symbol: position.symbol,
              position_snapshot_id: inserted.id,
              event_type: 'PRICE_CASHOUT',
              event_date: new Date().toISOString().slice(0, 10),
              gross_cash: snapshot.market_value ?? 0,
              net_cash: snapshot.market_value ?? 0,
              capital_released: snapshot.market_value ?? 0,
              realized_pnl: snapshot.unrealized_pnl ?? 0,
              notes: { source: 'tce-position-monitor', t_plus: snapshot.t_plus },
            });
            if (cashoutError) throw cashoutError;
          }
        }

        const active = activeCount ?? 0;
        if (active >= (config.max_positions ?? 2)) {
          await this.audit(config.account_id, 'POSITION_MONITOR', started, {
            market_session: true,
            active_position_count: active,
            positions_monitored: accountMonitored,
            signals_found: accountSignals,
            skipped: false,
            metadata: { pool_scan: 'blocked_by_position_capacity', max_positions: config.max_positions ?? 2 },
          });
        } else {
          await this.audit(config.account_id, 'POOL_SCAN', started, {
            market_session: true,
            active_position_count: active,
            positions_monitored: accountMonitored,
            signals_found: accountSignals,
            skipped: true,
            skip_reason: 'candidate_feed_not_configured',
            metadata: { open_slots: (config.max_positions ?? 2) - active, pool_size: config.pool_size ?? 5 },
          });
        }
      }

      this.logger.log(`TCE monitor complete: ${result.monitored} positions; signals=${result.signals.join(',') || 'none'}`);
      return result;
    } catch (error) {
      this.logger.error('TCE monitor failed', error instanceof Error ? error.stack : String(error));
      return { ...result, skipped: false, reason: 'error' };
    } finally {
      this.running = false;
    }
  }

  private buildSnapshot(position: Position, marketHours: boolean) {
    const price = position.market_price == null ? null : Number(position.market_price);
    const quantity = Number(position.quantity ?? 0);
    const avg = Number(position.avg_cost ?? 0);
    const cost = Number(position.cost_basis ?? avg * quantity);
    const value = price == null ? null : Number(position.market_value ?? price * quantity);
    const pnl = value == null ? null : Number(position.unrealized_pnl ?? value - cost);
    const pnlPct = pnl == null || cost <= 0 ? null : (pnl / cost) * 100;

    let signal = 'WATCH';
    if (pnlPct == null) signal = 'WATCH';
    else if (pnlPct >= 8) signal = 'CASHOUT';
    else if (pnlPct >= 5) signal = 'TAKE_PROFIT';
    else if (pnlPct <= -5) signal = 'CUT';
    else signal = 'HOLD';

    const score = pnlPct == null ? 0 : Math.min(100, Math.max(0, 50 + pnlPct * 5));

    return {
      account_id: position.account_id,
      symbol: position.symbol,
      market_price: price,
      quantity,
      avg_cost: avg,
      market_value: value == null ? null : Math.round(value),
      cost_basis: Math.round(cost),
      unrealized_pnl: pnl == null ? null : Math.round(pnl),
      unrealized_pnl_pct: pnlPct == null ? null : Number(pnlPct.toFixed(4)),
      signal,
      signal_score: Number(score.toFixed(3)),
      signal_reason: { pnl_pct: pnlPct == null ? null : Number(pnlPct.toFixed(2)), thresholds: { take_profit: 5, cashout: 8, cut: -5 }, price_source: 'tce_positions.market_price' },
      t_plus: 2,
      is_market_hours: marketHours,
    };
  }

  private async audit(accountId: string, runType: string, startedAt: string, values: Record<string, unknown>) {
    const { error } = await this.supabase.db.from('tce_monitor_runs').insert({
      account_id: accountId,
      run_type: runType,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ...values,
    });
    if (error) throw error;
  }

  private safeTimezone(timezone: string | null | undefined) {
    if (!timezone) return DEFAULT_TZ;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
      return timezone;
    } catch {
      this.logger.warn(`Invalid timezone ${timezone}; falling back to ${DEFAULT_TZ}`);
      return DEFAULT_TZ;
    }
  }

  private isMarketSession(timezone: string): boolean {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const day = get('weekday');
    if (day === 'Sat' || day === 'Sun') return false;
    const minutes = Number(get('hour')) * 60 + Number(get('minute'));
    return (minutes >= 540 && minutes < 690) || (minutes >= 780 && minutes <= 885);
  }

  private msToNextHour() {
    const now = Date.now();
    const next = Math.ceil((now + 1000) / INTERVAL_MS) * INTERVAL_MS;
    return Math.max(1000, next - now);
  }
}
