import { Injectable } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

export type TceSignalInput = { symbol: string; side: 'BUY' | 'SELL'; entry: number; tp: number; sl: number; rawMessage?: string; telegramUpdateId?: number; telegramChatId?: string };

const ACTIVE_SIGNAL_STATUSES = ['QUEUED', 'ACCEPTED'] as const;

@Injectable()
export class TceSignalService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async accept(userId: string, environment: string, signal: TceSignalInput) {
    const symbol = signal.symbol.trim().toUpperCase();
    const normalizedEnvironment = environment.trim() || 'production';

    // Telegram retries are idempotent by update id.
    if (signal.telegramUpdateId != null) {
      const { data: existing } = await this.supabase.db
        .from('tce_telegram_signals')
        .select('id,status,symbol,side,entry,tp,sl')
        .eq('user_id', userId)
        .eq('environment', normalizedEnvironment)
        .eq('telegram_update_id', signal.telegramUpdateId)
        .maybeSingle();
      if (existing) return { status: existing.status, signalId: existing.id, duplicate: true, signal: existing };
    }

    // Hard business invariant: one active signal/order per symbol for an account.
    // Check both the durable signal queue and the current position table; the DB
    // partial unique index below is the final race-condition guard.
    const { data: activeSignal, error: activeSignalError } = await this.supabase.db
      .from('tce_telegram_signals')
      .select('id,status,symbol,side')
      .eq('user_id', userId)
      .eq('environment', normalizedEnvironment)
      .eq('symbol', symbol)
      .in('status', [...ACTIVE_SIGNAL_STATUSES])
      .limit(1)
      .maybeSingle();
    if (activeSignalError) throw activeSignalError;
    if (activeSignal) throw new Error(`${symbol} already has an active signal/order.`);

    const { data: activePosition, error: positionError } = await this.supabase.db
      .from('tce_positions')
      .select('id,symbol,quantity,status')
      .eq('account_id', userId)
      .eq('symbol', symbol)
      .neq('status', 'CLOSED')
      .limit(1)
      .maybeSingle();
    if (positionError) throw positionError;
    if (activePosition) throw new Error(`${symbol} already has an active position.`);

    const { data, error } = await this.supabase.db
      .from('tce_telegram_signals')
      .insert({
        user_id: userId,
        environment: normalizedEnvironment,
        telegram_update_id: signal.telegramUpdateId ?? null,
        telegram_chat_id: signal.telegramChatId ?? null,
        raw_message: signal.rawMessage ?? '',
        symbol,
        side: signal.side,
        entry: signal.entry,
        tp: signal.tp,
        sl: signal.sl,
        status: 'QUEUED',
      })
      .select('id,status,symbol,side,entry,tp,sl')
      .single();

    if (error) {
      // SQLSTATE 23505 is expected when two signals for the same symbol race.
      if (error.code === '23505') throw new Error(`${symbol} already has an active signal/order.`);
      throw error;
    }
    return { status: data.status, signalId: data.id, signal: data };
  }
}
