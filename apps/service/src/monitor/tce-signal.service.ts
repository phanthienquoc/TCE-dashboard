import { Injectable, ConflictException } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

export type TceSignalInput = { symbol: string; side: 'BUY' | 'SELL'; entry: number; tp: number; sl: number; rawMessage?: string; telegramUpdateId?: number; telegramChatId?: string };

const ACTIVE_SIGNAL_STATUSES = ['QUEUED', 'PROCESSING', 'ACCEPTED', 'EXECUTING', 'PROTECTED'];

@Injectable()
export class TceSignalService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async accept(userId: string, environment: string, signal: TceSignalInput) {
    const symbol = signal.symbol.trim().toUpperCase();

    const { data: existing } = signal.telegramUpdateId == null
      ? { data: null as any }
      : await this.supabase.db
          .from('tce_telegram_signals')
          .select('id,status')
          .eq('user_id', userId)
          .eq('environment', environment)
          .eq('telegram_update_id', signal.telegramUpdateId)
          .maybeSingle();
    if (existing) return { status: existing.status, signalId: existing.id, duplicate: true };

    // Hard safety guard: one active signal/position per symbol for an account+environment.
    // The exchange position check is performed again by the execution worker immediately
    // before placing an order, so a stale queue row can never be trusted as the source of truth.
    const { data: activeSignals, error: activeError } = await this.supabase.db
      .from('tce_telegram_signals')
      .select('id,status,side,entry,tp,sl,created_at')
      .eq('user_id', userId)
      .eq('environment', environment)
      .eq('symbol', symbol)
      .in('status', ACTIVE_SIGNAL_STATUSES)
      .limit(1);
    if (activeError) throw activeError;
    if (activeSignals?.length) {
      throw new ConflictException(`Active ${symbol} signal already exists.`);
    }

    // Existing local position is also a hard stop. Binance/SSI reconciliation remains
    // the final authority at execution time.
    const { data: positions, error: positionError } = await this.supabase.db
      .from('tce_positions')
      .select('id,symbol,quantity,status')
      .eq('account_id', userId)
      .eq('symbol', symbol)
      .neq('status', 'CLOSED')
      .limit(1);
    if (positionError) throw positionError;
    if (positions?.length) {
      throw new ConflictException(`${symbol} already has an active position.`);
    }

    const { data, error } = await this.supabase.db
      .from('tce_telegram_signals')
      .insert({
        user_id: userId,
        environment,
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
      if (error.code === '23505') throw new ConflictException(`Active ${symbol} signal already exists.`);
      throw error;
    }
    return { status: data.status, signalId: data.id, signal: data };
  }
}
