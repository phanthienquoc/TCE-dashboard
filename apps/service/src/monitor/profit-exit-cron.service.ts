import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_PROFIT_TARGET_PCT = 10;
const TICK_MS = 60 * 1000;
const ACTIVE_ORDER_STATUSES = [
  'READY',
  'PENDING',
  'SUBMITTED',
  'PARTIALLY_FILLED',
  'PROCESSING',
  'ACCEPTED',
  'EXECUTING',
  'PROTECTED',
  'OPEN',
] as const;

type AutoSellConfig = {
  account_id: string;
  auto_sell_enabled: boolean;
  auto_sell_profit_target_pct: number;
  auto_sell_interval_minutes: number;
  auto_sell_last_run_at: string | null;
  auto_sell_hold_symbols: string[] | null;
  timezone?: string | null;
};

type Position = {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  avg_cost: number | null;
  cost_basis: number | null;
  market_price: number | null;
  market_value: number | null;
  status: string;
};

type RunOptions = {
  accountId?: string;
  force?: boolean;
  dryRun?: boolean;
};

export type AutoSellDecision =
  | {
      action: 'CREATE';
      targetPrice: number;
      profitPct: number;
      costBasis: number;
      marketValue: number;
    }
  | { action: 'SKIP'; reason: string };

export function evaluateAutoSell(
  position: Pick<
    Position,
    'quantity' | 'avg_cost' | 'cost_basis' | 'market_price' | 'market_value'
  >,
  targetPct: number
): AutoSellDecision {
  const quantity = Number(position.quantity);
  const avgCost = Number(position.avg_cost ?? 0);
  const costBasis = Number(position.cost_basis ?? avgCost * quantity);
  const marketPrice = Number(position.market_price ?? 0);
  const marketValue = Number(position.market_value ?? marketPrice * quantity);
  const target = Number(targetPct);
  if (!Number.isFinite(quantity) || quantity <= 0)
    return { action: 'SKIP', reason: 'invalid_quantity' };
  if (!Number.isFinite(costBasis) || costBasis <= 0)
    return { action: 'SKIP', reason: 'invalid_cost_basis' };
  if (!Number.isFinite(marketPrice) || marketPrice <= 0)
    return { action: 'SKIP', reason: 'invalid_market_price' };
  if (!Number.isFinite(marketValue) || marketValue <= 0)
    return { action: 'SKIP', reason: 'invalid_market_value' };
  if (!Number.isFinite(target) || target < 0) return { action: 'SKIP', reason: 'invalid_target' };
  const profitPct = ((marketValue - costBasis) / costBasis) * 100;
  if (profitPct < target) return { action: 'SKIP', reason: 'target_not_reached' };
  return { action: 'CREATE', targetPrice: marketPrice, profitPct, costBasis, marketValue };
}

export function normalizeHoldSymbols(symbols: unknown): string[] {
  if (!Array.isArray(symbols)) return [];
  return [...new Set(
    symbols
      .filter((symbol): symbol is string => typeof symbol === 'string')
      .map(symbol => symbol.trim().toUpperCase())
      .filter(Boolean)
  )].sort();
}

@Injectable()
export class ProfitExitCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProfitExitCronService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly supabase: SupabaseClientService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), TICK_MS);
    void this.run();
    this.logger.log('Profit-exit cron started; default is disabled, 60m interval, 10% target');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(options: RunOptions = {}) {
    if (this.running) return { skipped: true, reason: 'already_running', created: 0 };
    this.running = true;
    let created = 0;
    let evaluated = 0;
    let held = 0;
    const candidates: Array<{
      symbol: string;
      profitPct: number;
      targetPrice: number;
      quantity: number;
      action: 'CREATE' | 'SKIP_HOLD';
    }> = [];
    try {
      let query = this.supabase.db
        .from('tce_strategy_config')
        .select(
          'account_id,auto_sell_enabled,auto_sell_profit_target_pct,auto_sell_interval_minutes,auto_sell_last_run_at,auto_sell_hold_symbols,timezone'
        );
      if (options.accountId) query = query.eq('account_id', options.accountId);
      else query = query.eq('auto_sell_enabled', true);
      const { data: configs, error } = await query;
      if (error) throw error;
      if (options.accountId && !configs?.length) {
        return { skipped: false, reason: 'config_not_found', created: 0, evaluated: 0, held: 0, candidates: [] };
      }

      for (const config of (configs ?? []) as AutoSellConfig[]) {
        const timezone = this.safeTimezone(config.timezone);
        if (!options.force && (!this.isMarketSession(timezone) || !this.isDue(config))) continue;
        if (!options.dryRun && !options.accountId && !config.auto_sell_enabled) continue;

        const startedAt = new Date().toISOString();
        const { data: positions, error: positionError } = await this.supabase.db
          .from('tce_positions')
          .select(
            'id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,status'
          )
          .eq('account_id', config.account_id)
          .neq('status', 'CLOSED')
          .order('symbol');
        if (positionError) throw positionError;

        const holdSymbols = new Set(normalizeHoldSymbols(config.auto_sell_hold_symbols));
        let accountCreated = 0;
        for (const position of (positions ?? []) as Position[]) {
          const symbol = position.symbol.trim().toUpperCase();
          if (holdSymbols.has(symbol)) {
            held += 1;
            candidates.push({ symbol, profitPct: 0, targetPrice: 0, quantity: Number(position.quantity), action: 'SKIP_HOLD' });
            continue;
          }
          evaluated += 1;
          const decision = evaluateAutoSell(
            position,
            config.auto_sell_profit_target_pct ?? DEFAULT_PROFIT_TARGET_PCT
          );
          if (decision.action !== 'CREATE') continue;
          const quantity = Math.trunc(Number(position.quantity));
          if (quantity <= 0) continue;
          candidates.push({ symbol, profitPct: decision.profitPct, targetPrice: decision.targetPrice, quantity, action: 'CREATE' });
          if (options.dryRun) continue;

          const note = `TCE_AUTO_SELL:${position.id}:${Number(config.auto_sell_profit_target_pct ?? DEFAULT_PROFIT_TARGET_PCT)}`;
          const { data: activeOrders, error: orderLookupError } = await this.supabase.db
            .from('tce_orders')
            .select('id,status')
            .eq('account_id', config.account_id)
            .eq('symbol', symbol)
            .eq('side', 'SELL')
            .in('status', [...ACTIVE_ORDER_STATUSES])
            .limit(1);
          if (orderLookupError) throw orderLookupError;
          if ((activeOrders ?? []).length) continue;
          const { data: existingIntent, error: intentError } = await this.supabase.db
            .from('tce_orders')
            .select('id')
            .eq('account_id', config.account_id)
            .eq('note', note)
            .maybeSingle();
          if (intentError) throw intentError;
          if (existingIntent) continue;
          const { error: insertError } = await this.supabase.db.from('tce_orders').insert({
            account_id: config.account_id,
            order_date: new Date().toISOString().slice(0, 10),
            symbol,
            side: 'SELL',
            price: decision.targetPrice,
            quantity,
            gross_value: Math.round(decision.marketValue),
            fee_tax: 0,
            net_cashflow: Math.round(decision.marketValue),
            cycle_no: 0,
            status: 'READY',
            note,
          });
          if (insertError) throw insertError;
          created += 1;
          accountCreated += 1;
        }
        if (!options.dryRun) {
          await this.supabase.db
            .from('tce_strategy_config')
            .update({ auto_sell_last_run_at: startedAt, updated_at: startedAt })
            .eq('account_id', config.account_id);
          await this.audit(config.account_id, startedAt, positions?.length ?? 0, accountCreated);
        }
      }
      return { skipped: false, created, evaluated, held, dryRun: options.dryRun === true, candidates };
    } catch (error) {
      this.logger.error(
        'Profit-exit cron failed',
        error instanceof Error ? error.stack : String(error)
      );
      return { skipped: false, reason: 'error', created, evaluated, held, dryRun: options.dryRun === true, candidates };
    } finally {
      this.running = false;
    }
  }

  private isDue(config: AutoSellConfig) {
    const intervalMinutes = Math.min(
      1440,
      Math.max(1, Number(config.auto_sell_interval_minutes ?? DEFAULT_INTERVAL_MINUTES))
    );
    if (!config.auto_sell_last_run_at) return true;
    const last = Date.parse(config.auto_sell_last_run_at);
    return Number.isFinite(last) && Date.now() - last >= intervalMinutes * 60 * 1000;
  }

  private async audit(accountId: string, startedAt: string, monitored: number, created: number) {
    const { error } = await this.supabase.db.from('tce_monitor_runs').insert({
      account_id: accountId,
      run_type: 'AUTO_SELL',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      market_session: true,
      positions_monitored: monitored,
      signals_found: created,
      skipped: false,
      metadata: {
        source: 'tce-profit-exit-cron',
        created_sell_orders: created,
        target_basis: 'cost_basis',
      },
    });
    if (error) this.logger.warn(`Unable to audit profit-exit run: ${error.message}`);
  }

  private safeTimezone(timezone: string | null | undefined) {
    if (!timezone) return DEFAULT_TZ;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
      return timezone;
    } catch {
      return DEFAULT_TZ;
    }
  }

  private isMarketSession(timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date());
    const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    const day = get('weekday');
    if (day === 'Sat' || day === 'Sun') return false;
    const minutes = Number(get('hour')) * 60 + Number(get('minute'));
    return (minutes >= 540 && minutes < 690) || (minutes >= 780 && minutes <= 885);
  }
}
