import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_PROFIT_TARGET_PCT = 10;
const PRICE_ALERT_BAND_PCT = 7;
const TICK_MS = 60 * 1000;

type AutoSellConfig = { account_id: string; auto_sell_enabled: boolean; auto_sell_profit_target_pct: number; auto_sell_interval_minutes: number; auto_sell_last_run_at: string | null; auto_sell_hold_symbols: string[] | null; timezone?: string | null };
type Position = { id: string; account_id: string; user_id: string; symbol: string; quantity: number; avg_cost: number | null; cost_basis: number | null; market_price: number | null; market_value: number | null; status: string };
type RunOptions = { accountId?: string; force?: boolean; dryRun?: boolean };

export type AutoSellDecision = { action: 'NOTIFY'; buyPrice: number; currentPrice: number; targetPrice: number; profitPct: number; currentProfitPct: number; priceDistancePct: number; costBasis: number; marketValue: number } | { action: 'SKIP'; reason: string };

export function evaluateAutoSell(position: Pick<Position, 'quantity' | 'avg_cost' | 'cost_basis' | 'market_price'>, targetPct: number): AutoSellDecision {
  const quantity = Number(position.quantity);
  const avgCost = Number(position.avg_cost ?? 0);
  const costBasis = Number(position.cost_basis ?? avgCost * quantity);
  const buyPrice = avgCost > 0 ? avgCost : costBasis / quantity;
  const currentPrice = Number(position.market_price ?? 0);
  const target = Number(targetPct);
  if (!Number.isFinite(quantity) || quantity <= 0) return { action: 'SKIP', reason: 'invalid_quantity' };
  if (!Number.isFinite(costBasis) || costBasis <= 0) return { action: 'SKIP', reason: 'invalid_cost_basis' };
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) return { action: 'SKIP', reason: 'invalid_buy_price' };
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return { action: 'SKIP', reason: 'missing_market_price' };
  if (!Number.isFinite(target) || target < 0) return { action: 'SKIP', reason: 'invalid_target' };
  const targetPrice = buyPrice * (1 + target / 100);
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) return { action: 'SKIP', reason: 'invalid_target_price' };
  const currentProfitPct = ((currentPrice - buyPrice) / buyPrice) * 100;
  const priceDistancePct = Math.abs(currentProfitPct);
  if (currentPrice >= targetPrice) return { action: 'NOTIFY', buyPrice, currentPrice, targetPrice, profitPct: target, currentProfitPct, priceDistancePct, costBasis, marketValue: targetPrice * quantity };
  if (priceDistancePct > PRICE_ALERT_BAND_PCT) return { action: 'SKIP', reason: 'outside_price_alert_band' };
  return { action: 'NOTIFY', buyPrice, currentPrice, targetPrice, profitPct: target, currentProfitPct, priceDistancePct, costBasis, marketValue: targetPrice * quantity };
}

export function normalizeHoldSymbols(symbols: unknown): string[] {
  if (!Array.isArray(symbols)) return [];
  return [...new Set(symbols.filter((s): s is string => typeof s === 'string').map(s => s.trim().toUpperCase()).filter(Boolean))].sort();
}

@Injectable()
export class ProfitExitCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProfitExitCronService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly supabase: SupabaseClientService) {}
  onModuleInit() { this.timer = setInterval(() => void this.run(), TICK_MS); void this.run(); this.logger.log(`Profit-exit tracker started; default is disabled, 60m interval, 10% target, ±${PRICE_ALERT_BAND_PCT}% alert band`); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async run(options: RunOptions = {}) {
    if (this.running) return { skipped: true, reason: 'already_running', created: 0, notified: 0, messages: [] };
    this.running = true;
    let created = 0, notified = 0, evaluated = 0, held = 0;
    const messages: string[] = [];
    const candidates: Array<{ symbol: string; profitPct: number; currentProfitPct: number; currentPrice: number; buyPrice: number; targetPrice: number; quantity: number; action: 'NOTIFY' | 'SKIP' | 'SKIP_HOLD'; reason?: string }> = [];
    try {
      let query = this.supabase.db.from('tce_strategy_config').select('account_id,auto_sell_enabled,auto_sell_profit_target_pct,auto_sell_interval_minutes,auto_sell_last_run_at,auto_sell_hold_symbols,timezone');
      if (options.accountId) query = query.eq('account_id', options.accountId); else query = query.eq('auto_sell_enabled', true);
      const { data: configs, error } = await query;
      if (error) throw error;
      if (options.accountId && !configs?.length) return { skipped: false, reason: 'config_not_found', created: 0, notified: 0, evaluated: 0, held: 0, messages: [], candidates: [] };
      for (const config of (configs ?? []) as AutoSellConfig[]) {
        const timezone = this.safeTimezone(config.timezone);
        if (!options.force && (!this.isMarketSession(timezone) || !this.isDue(config))) continue;
        const startedAt = new Date().toISOString();
        const { data: positions, error: positionError } = await this.supabase.db.from('tce_positions').select('id,account_id,user_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,status').eq('account_id', config.account_id).neq('status', 'CLOSED').order('symbol');
        if (positionError) throw positionError;
        const holdSymbols = new Set(normalizeHoldSymbols(config.auto_sell_hold_symbols));
        let accountNotified = 0;
        for (const position of (positions ?? []) as Position[]) {
          const symbol = position.symbol.trim().toUpperCase();
          const targetPct = Number(config.auto_sell_profit_target_pct ?? DEFAULT_PROFIT_TARGET_PCT);
          const rawQuantity = Number(position.quantity), quantity = Math.trunc(rawQuantity);
          const avgCost = Number(position.avg_cost ?? 0), costBasis = Number(position.cost_basis ?? avgCost * rawQuantity);
          const buyPrice = avgCost > 0 ? avgCost : costBasis / rawQuantity, currentPrice = Number(position.market_price ?? 0);
          const targetPrice = Number.isFinite(buyPrice) && buyPrice > 0 && Number.isFinite(targetPct) && targetPct >= 0 ? buyPrice * (1 + targetPct / 100) : 0;
          const currentProfitPct = Number.isFinite(buyPrice) && buyPrice > 0 && Number.isFinite(currentPrice) && currentPrice > 0 ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0;
          if (holdSymbols.has(symbol)) { held += 1; candidates.push({ symbol, profitPct: targetPct, currentProfitPct, currentPrice, buyPrice, targetPrice, quantity, action: 'SKIP_HOLD', reason: 'hold_symbol' }); continue; }
          evaluated += 1;
          const decision = evaluateAutoSell(position, targetPct);
          if (decision.action !== 'NOTIFY') { candidates.push({ symbol, profitPct: targetPct, currentProfitPct, currentPrice, buyPrice, targetPrice, quantity, action: 'SKIP', reason: decision.reason }); continue; }
          const sellReady = decision.currentPrice >= decision.targetPrice;
          candidates.push({ symbol, profitPct: decision.profitPct, currentProfitPct: decision.currentProfitPct, currentPrice: decision.currentPrice, buyPrice: decision.buyPrice, targetPrice: decision.targetPrice, quantity, action: 'NOTIFY', reason: sellReady ? 'sell_ready' : 'inside_price_alert_band' });
          if (!options.dryRun) messages.push(sellReady ? `TCE AUTO-SELL READY — ${symbol}: Giá mua ${decision.buyPrice.toFixed(2)}, giá hiện tại ${decision.currentPrice.toFixed(2)} (+${decision.currentProfitPct.toFixed(2)}%), TP ${decision.targetPrice.toFixed(2)} (+${decision.profitPct.toFixed(2)}%), KL ${quantity}. SELL candidate ready for explicit submission.` : `TCE AUTO-SELL TRACK — ${symbol}: Giá mua ${decision.buyPrice.toFixed(2)}, giá hiện tại ${decision.currentPrice.toFixed(2)} (${decision.currentProfitPct >= 0 ? '+' : ''}${decision.currentProfitPct.toFixed(2)}%), TP ${decision.targetPrice.toFixed(2)} (+${decision.profitPct.toFixed(2)}%), vùng theo dõi ±${PRICE_ALERT_BAND_PCT}% giá mua, KL ${quantity}.`);
          notified += 1; accountNotified += 1;
        }
        if (!options.dryRun) { await this.supabase.db.from('tce_strategy_config').update({ auto_sell_last_run_at: startedAt, updated_at: startedAt }).eq('account_id', config.account_id); await this.audit(config.account_id, startedAt, positions?.length ?? 0, accountNotified, candidates.filter(candidate => candidate.action === 'NOTIFY').length, messages); }
      }
      return { skipped: false, created, notified, evaluated, held, dryRun: options.dryRun === true, messages, candidates };
    } catch (error) { this.logger.error('Profit-exit tracking failed', error instanceof Error ? error.stack : String(error)); return { skipped: false, reason: 'error', created, notified, evaluated, held, dryRun: options.dryRun === true, messages, candidates }; } finally { this.running = false; }
  }
  private isDue(config: AutoSellConfig) { const intervalMinutes = Math.min(1440, Math.max(1, Number(config.auto_sell_interval_minutes ?? DEFAULT_INTERVAL_MINUTES))); if (!config.auto_sell_last_run_at) return true; const last = Date.parse(config.auto_sell_last_run_at); return Number.isFinite(last) && Date.now() - last >= intervalMinutes * 60 * 1000; }
  private async audit(accountId: string, startedAt: string, monitored: number, notified: number, signals: number, messages: string[]) { const { error } = await this.supabase.db.from('tce_monitor_runs').insert({ account_id: accountId, run_type: 'AUTO_SELL', started_at: startedAt, finished_at: new Date().toISOString(), market_session: true, positions_monitored: monitored, signals_found: signals, skipped: false, metadata: { source: 'tce-profit-exit-cron', created_sell_orders: 0, notified, messages, target_basis: 'avg_cost', alert_band_pct: PRICE_ALERT_BAND_PCT, execution: 'EXPLICIT_SUBMIT_REQUIRED' } }); if (error) this.logger.warn(`Unable to audit profit-exit run: ${error.message}`); }
  private safeTimezone(timezone: string | null | undefined) { if (!timezone) return DEFAULT_TZ; try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); return timezone; } catch { return DEFAULT_TZ; } }
  private isMarketSession(timezone: string) { const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()); const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''; const day = get('weekday'); if (day === 'Sat' || day === 'Sun') return false; const minutes = Number(get('hour')) * 60 + Number(get('minute')); return (minutes >= 540 && minutes < 690) || (minutes >= 780 && minutes <= 885); }
}
