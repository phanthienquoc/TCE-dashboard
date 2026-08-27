import { Injectable } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

export type TceSignalInput = { symbol: string; side: 'BUY' | 'SELL'; entry: number; tp: number; sl: number; rawMessage?: string; telegramUpdateId?: number; telegramChatId?: string };

@Injectable()
export class TceSignalService {
  constructor(private readonly supabase: SupabaseClientService) {}
  async accept(userId: string, environment: string, signal: TceSignalInput) {
    const { data: existing } = signal.telegramUpdateId == null ? { data: null as any } : await this.supabase.db.from('tce_telegram_signals').select('id,status').eq('user_id', userId).eq('environment', environment).eq('telegram_update_id', signal.telegramUpdateId).maybeSingle();
    if (existing) return { status: existing.status, signalId: existing.id, duplicate: true };
    const { data, error } = await this.supabase.db.from('tce_telegram_signals').insert({ user_id: userId, environment, telegram_update_id: signal.telegramUpdateId ?? null, telegram_chat_id: signal.telegramChatId ?? null, raw_message: signal.rawMessage ?? '', symbol: signal.symbol, side: signal.side, entry: signal.entry, tp: signal.tp, sl: signal.sl, status: 'QUEUED' }).select('id,status,symbol,side,entry,tp,sl').single();
    if (error) throw error;
    return { status: data.status, signalId: data.id, signal: data };
  }
}
