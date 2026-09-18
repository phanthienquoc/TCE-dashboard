import { Injectable, Logger } from '@nestjs/common';
import {
  CapitalRotationDividendLifecycle,
  CapitalRotationLifecyclePosition,
  expectedT2Window,
  lifecycleStateFromDividend,
} from '@tce/tce';
import { SupabaseClientService } from '../db/supabase.client';

const DAY_MS = 86_400_000;

type PositionRow = {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  avg_cost: number;
  market_price: number | null;
  dividend_lifecycle: string | null;
  ex_dividend_at: string | null;
  record_date: string | null;
  dividend_payment_at: string | null;
  lifecycle_updated_at: string | null;
  lifecycle_idempotency_key: string | null;
  status: string;
};

type StockEvent = {
  ex_right_date: string | null;
  record_date: string | null;
  payment_date: string | null;
  dividend_value: number | null;
};

@Injectable()
export class CapitalRotationDividendLifecycleService {
  private readonly logger = new Logger(CapitalRotationDividendLifecycleService.name);
  private readonly lifecycle = new CapitalRotationDividendLifecycle();

  constructor(private readonly supabase: SupabaseClientService) {}

  async reconcileAccount(accountId: string, correlationId = `crde-lifecycle-${Date.now()}`) {
    const { data: positions, error } = await this.supabase.db
      .from('tce_positions')
      .select(
        'id,account_id,symbol,quantity,avg_cost,market_price,dividend_lifecycle,ex_dividend_at,record_date,dividend_payment_at,lifecycle_updated_at,lifecycle_idempotency_key,status',
      )
      .eq('account_id', accountId)
      .eq('status', 'OPEN')
      .order('symbol');
    if (error) throw error;

    const results: Array<{ symbol: string; state?: string; action: string; reason?: string }> = [];
    for (const row of (positions ?? []) as PositionRow[]) {
      results.push(await this.reconcilePosition(row, correlationId));
    }
    return results;
  }

  private async reconcilePosition(row: PositionRow, correlationId: string) {
    const event = await this.findDividendEvent(row.symbol);
    if (!event?.ex_right_date) {
      return { symbol: row.symbol, action: 'WAIT', reason: 'dividend_event_missing' };
    }

    const mappedState = lifecycleStateFromDividend(
      (row.dividend_lifecycle ?? 'ELIGIBLE') as Parameters<typeof lifecycleStateFromDividend>[0],
    );
    const currentState: CapitalRotationLifecyclePosition['state'] =
      mappedState ??
      (row.dividend_lifecycle === 'EXIT_READY' ||
      row.dividend_lifecycle === 'CLOSED' ||
      row.dividend_lifecycle === 'SLOT_RECYCLED'
        ? row.dividend_lifecycle
        : 'HOLDING');

    const exAt = `${event.ex_right_date}T00:00:00.000Z`;
    const paymentAt = event.payment_date ? `${event.payment_date}T00:00:00.000Z` : undefined;
    const position: CapitalRotationLifecyclePosition = {
      positionId: row.id,
      symbol: row.symbol,
      quantity: Number(row.quantity ?? 0),
      avgCost: Number(row.avg_cost ?? 0),
      currentPrice: row.market_price == null ? undefined : Number(row.market_price),
      dividendPerShare: event.dividend_value == null ? undefined : Number(event.dividend_value),
      exDividendAt: row.ex_dividend_at ?? exAt,
      paymentAt: row.dividend_payment_at ?? paymentAt,
      dividendLifecycle: (row.dividend_lifecycle ?? 'ELIGIBLE') as CapitalRotationLifecyclePosition['dividendLifecycle'],
      state: currentState,
      updatedAt: row.lifecycle_updated_at ?? new Date(0).toISOString(),
    };

    const now = Date.now();
    if (currentState === 'HOLDING' && Date.parse(exAt) <= now) {
      return this.persist(
        row,
        position,
        'EX_DIVIDEND',
        correlationId,
        `ex-date-reached:${event.ex_right_date}`,
        { exDividendAt: exAt, paymentAt, recordDate: event.record_date },
      );
    }

    const t2At = expectedT2Window(exAt);
    if (currentState === 'EX_DIVIDEND' && t2At && Date.parse(t2At) <= now) {
      return this.persist(
        row,
        position,
        'T2_PENDING',
        correlationId,
        `t2-window-reached:${t2At}`,
        { exDividendAt: exAt, paymentAt, recordDate: event.record_date },
      );
    }

    if (currentState === 'T2_PENDING' && paymentAt && Date.parse(paymentAt) <= now) {
      const confirmation = await this.findDividendConfirmation(row.account_id, row.symbol, event.payment_date!);
      if (confirmation) {
        return this.persist(
          row,
          position,
          'DIVIDEND_CONFIRMED',
          correlationId,
          'cash-dividend-confirmed',
          {
            exDividendAt: exAt,
            paymentAt,
            recordDate: event.record_date,
            netCash: Number(confirmation.net_cash ?? 0),
          },
        );
      }
      return { symbol: row.symbol, state: currentState, action: 'WAIT', reason: 'payment_due_confirmation_missing' };
    }

    return { symbol: row.symbol, state: currentState, action: 'HOLD' };
  }

  private async persist(
    row: PositionRow,
    position: CapitalRotationLifecyclePosition,
    to: CapitalRotationLifecyclePosition['state'],
    correlationId: string,
    reason: string,
    evidence?: { exDividendAt?: string; paymentAt?: string; recordDate?: string | null; netCash?: number },
  ) {
    const idempotencyKey = `crde:lifecycle:${row.id}:${to}:${evidence?.paymentAt ?? evidence?.exDividendAt ?? 'na'}`;
    if (row.lifecycle_idempotency_key === idempotencyKey) {
      return { symbol: row.symbol, state: row.dividend_lifecycle ?? position.state, action: 'IDEMPOTENT_REPLAY' };
    }

    const result = this.lifecycle.transition(
      position,
      to,
      { correlationId, idempotencyKey },
      reason,
      evidence,
    );
    if (!result.ok) {
      this.logger.warn(`Lifecycle transition rejected for ${row.symbol}: ${result.code}`);
      return { symbol: row.symbol, state: position.state, action: 'REJECTED', reason: result.code };
    }

    const next = result.position;
    const { error: positionError } = await this.supabase.db
      .from('tce_positions')
      .update({
        dividend_lifecycle: next.dividendLifecycle,
        ex_dividend_at: next.exDividendAt ?? null,
        record_date: evidence?.recordDate ?? row.record_date ?? null,
        dividend_payment_at: next.paymentAt ?? null,
        lifecycle_updated_at: next.updatedAt,
        lifecycle_idempotency_key: idempotencyKey,
      })
      .eq('id', row.id)
      .eq('account_id', row.account_id);
    if (positionError) throw positionError;

    const { error: auditError } = await this.supabase.db.from('tce_cashout_events').insert({
      account_id: row.account_id,
      symbol: row.symbol,
      event_type: `CRDE_LIFECYCLE_${to}`,
      event_date: next.updatedAt.slice(0, 10),
      gross_cash: evidence?.netCash ?? 0,
      net_cash: evidence?.netCash ?? 0,
      capital_released: 0,
      realized_pnl: 0,
      notes: {
        source: 'crde-dividend-lifecycle',
        position_id: row.id,
        from: position.state,
        to,
        correlation_id: correlationId,
        idempotency_key: idempotencyKey,
        reason,
        dividend_evidence: evidence ?? null,
      },
    });
    if (auditError) throw auditError;

    return { symbol: row.symbol, state: to, action: 'TRANSITIONED', reason };
  }

  private async findDividendEvent(symbol: string): Promise<StockEvent | null> {
    const today = new Date();
    const lookback = new Date(today.getTime() - 30 * DAY_MS).toISOString().slice(0, 10);
    const { data, error } = await this.supabase.db
      .from('stock_events')
      .select('ex_right_date,record_date,payment_date,dividend_value')
      .eq('symbol', symbol)
      .gte('ex_right_date', lookback)
      .order('ex_right_date', { ascending: true })
      .limit(1);
    if (error) throw error;
    return (data?.[0] as StockEvent | undefined) ?? null;
  }

  private async findDividendConfirmation(accountId: string, symbol: string, paymentDate: string) {
    const { data, error } = await this.supabase.db
      .from('tce_cashout_events')
      .select('net_cash,event_date,notes')
      .eq('account_id', accountId)
      .eq('symbol', symbol)
      .eq('event_type', 'DIVIDEND_CONFIRMED')
      .gte('event_date', paymentDate)
      .order('event_date', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  }
}
