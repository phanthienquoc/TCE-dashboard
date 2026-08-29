import { Injectable } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';
import { TelegramDebugService } from '../telegram/telegram-debug.service';

export type TceSignalInput = {
  symbol: string;
  side: 'BUY' | 'SELL';
  entry: number;
  tp: number;
  sl: number;
  rawMessage?: string;
  telegramUpdateId?: number;
  telegramChatId?: string;
};
const ACTIVE_SIGNAL_STATUSES = ['QUEUED', 'ACCEPTED'] as const;

@Injectable()
export class TceSignalService {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly debug: TelegramDebugService
  ) {}

  async accept(userId: string, environment: string, signal: TceSignalInput) {
    const symbol = signal.symbol.trim().toUpperCase();
    const normalizedEnvironment = environment.trim() || 'production';
    if (signal.telegramUpdateId != null) {
      const { data: existing } = await this.supabase.db
        .from('tce_telegram_signals')
        .select('id,status,symbol,side,entry,tp,sl')
        .eq('user_id', userId)
        .eq('environment', normalizedEnvironment)
        .eq('telegram_update_id', signal.telegramUpdateId)
        .maybeSingle();
      if (existing) {
        void this.debug.emit(
          userId,
          'tce-signal',
          'DEBUG',
          `Duplicate Telegram update ignored for ${symbol}`,
          { environment: normalizedEnvironment, signalId: existing.id }
        );
        return {
          status: existing.status,
          signalId: existing.id,
          duplicate: true,
          signal: existing,
        };
      }
    }
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
      if (error.code === '23505') throw new Error(`${symbol} already has an active signal/order.`);
      throw error;
    }
    void this.debug.emit(userId, 'tce-signal', 'INFO', `Signal ${symbol} ${signal.side} queued`, {
      environment: normalizedEnvironment,
      signalId: data.id,
      entry: signal.entry,
      tp: signal.tp,
      sl: signal.sl,
    });
    return { status: data.status, signalId: data.id, signal: data };
  }
}
