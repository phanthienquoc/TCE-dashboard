import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

const TZ = 'Asia/Ho_Chi_Minh';
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
      const { data: accounts, error: accountError } = await this.supabase.db
        .from('tce_strategy_config')
        .select('account_id,max_positions,pool_size,monitor_interval_minutes,market_open,market_close,timezone');
      if (accountError) throw accountError;

      for (const config of accounts ?? []) {
        const inSession = this.isMarketSession(config.timezone ?? TZ);
        const { count } = await this.supabase.db
          .from('tce_positions')
          .select('symbol', { count: 'exact', head: true })
          .eq('account_id', config.account_id)
          .neq('status', 'CLOSED');
        const activeCount = count ?? 0;

        if (!inSession) {
          await this.audit(config.account_id, 'POSITION_MONITOR', started, { market_session: false, active_position_count: activeCount, skipped: true, skip_reason: 'outside_market_session' });
          continue;
        }

        const { data: positions, error: positionError } = await this.supabase.db
          .from('tce_positions')
          .select('id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status,cycle_no')
          .eq('account_id', config.account_id)
          .neq('status', 'CLOSED')
          .order('symbol');
        if (positionError) throw positionError;

        for (const position of (positions ?? []) as Position[]) {
          const snapshot = this.buildSnapshot(position, true);
          const { data: inserted, error: snapshotError } = await this.supabase.db
            .from('tce_position_snapshots')
            .insert(snapshot)
            .select('id')
            .single();
          if (snapshotError) throw snapshotError;
          result.monitored += 1;
          if (snapshot.signal !== 'HOLD') result.signals.push(`${position.symbol}:${snapshot.signal}`);

          if (snapshot.signal === 'CASHOUT' && inserted?.id) {
            await this.supabase.db.from('tce_cashout_events').insert({
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
          }
        }

        // Never hunt new names while the two-position capacity is full.
        if (activeCount >= (config.max_positions ?? 2)) {
          await this.audit(config.account_id, 'POSITION_MONITOR', started, {
            market_session: true,
            active_position_count: activeCount,
            positions_monitored: positions?.length ?? 0,
            signals_found: result.signals.length,
            skipped: false,
            metadata: { pool_scan: 'blocked_by_position_capacity', max_positions: config.max_positions ?? 2 },
          });
        } else {
          await this.audit(config.account_id, 'POOL_SCAN', started, {
            market_session: true,
            active_position_count: activeCount,
            positions_monitored: positions?.length ?? 0,
            signals_found: result.signals.length,
            skipped: true,
            skip_reason: 'candidate_feed_not_configured',
            metadata: { open_slots: (config.max_positions ?? 2) - activeCount, pool_size: config.pool_size ?? 5 },
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
    const price = Number(position.market_price ?? position.avg_cost ?? 0);
    const quantity = Number(position.quantity ?? 0);
    const avg = Number(position.avg_cost ?? 0);
    const cost = Number(position.cost_basis ?? avg * quantity);
    const value = Number(position.market_value ?? price * quantity);
    const pnl = Number(position.unrealized_pnl ?? value - cost);
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

    let signal = 'HOLD';
    if (price <= 0) signal = 'WATCH';
    else if (pnlPct >= 8) signal = 'CASHOUT';
    else if (pnlPct >= 5) signal = 'TAKE_PROFIT';
    else if (pnlPct <= -5) signal = 'CUT';

    return {
      account_id: position.account_id,
      symbol: position.symbol,
      market_price: price || null,
      quantity,
      avg_cost: avg,
      market_value: Math.round(value),
      cost_basis: Math.round(cost),
      unrealized_pnl: Math.round(pnl),
      unrealized_pnl_pct: Number(pnlPct.toFixed(4)),
      signal,
      signal_score: Number(Math.min(100, Math.max(0, 50 + pnlPct * 5)).toFixed(3)),
      signal_reason: { pnl_pct: Number(pnlPct.toFixed(2)), thresholds: { take_profit: 5, cashout: 8, cut: -5 }, price_source: 'tce_positions.market_price' },
      t_plus: 2,
      is_market_hours: marketHours,
    };
  }

  private async audit(accountId: string, runType: string, startedAt: string, values: Record<string, unknown>) {
    await this.supabase.db.from('tce_monitor_runs').insert({
      account_id: accountId,
      run_type: runType,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ...values,
    });
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
