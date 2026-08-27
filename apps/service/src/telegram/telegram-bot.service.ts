import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CONTRACT_TOKENS, PlatformCredentialPort } from '@tce/contracts';
import { SupabaseClientService } from '../db/supabase.client';
import { TceSignalService } from '../monitor/tce-signal.service';

export type TceTelegramSignal = { symbol: string; side: 'BUY' | 'SELL'; entry: number; tp: number; sl: number };

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly offsets = new Map<string, number>(); private readonly timers = new Map<string, ReturnType<typeof setTimeout>>(); private readonly running = new Set<string>();
  constructor(@Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort, private readonly signals: TceSignalService, private readonly supabase: SupabaseClientService) {}
  async onModuleInit() {
    const { data, error } = await this.supabase.db.from('platform_credentials').select('user_id,environment').eq('provider', 'telegram').eq('is_active', true);
    if (error) { this.logger.warn(`Unable to restore Telegram bots: ${error.message}`); return; }
    for (const row of data ?? []) await this.start(String(row.user_id), String(row.environment ?? 'production'));
  }
  async testToken(token: string) { if (!token.trim()) throw new Error('Telegram bot token is required'); const me = await this.telegram(token.trim(), 'getMe'); if (!me.ok) throw new Error(me.description ?? 'Telegram token is invalid'); return { ok: true, bot: me.result }; }
  parseSignal(text: string): TceTelegramSignal {
    const normalized = text.replace(/[\u2013\u2014]/g, '-').trim(); const head = normalized.match(/^\s*([A-Z0-9._-]+)\s+(BUY|SELL)\b/im); const entry = normalized.match(/\bENTRY\s+([0-9]+(?:\.[0-9]+)?)\b/gi) ?? []; const tp = normalized.match(/\bTP\s+([0-9]+(?:\.[0-9]+)?)\b/gi) ?? []; const sl = normalized.match(/\bSL\s+([0-9]+(?:\.[0-9]+)?)\b/gi) ?? [];
    if (!head || entry.length !== 1 || tp.length !== 1 || sl.length !== 1) throw new Error('Invalid TCE signal. Expected exactly SYMBOL SIDE, ENTRY price, TP price and SL price.');
    if (/\bENTRY\s+[0-9.]+\s*[-_]\s*[0-9.]+/i.test(normalized)) throw new Error('Entry must contain exactly one price; ranges are not accepted.');
    const value = (match: string) => Number(match.match(/[0-9]+(?:\.[0-9]+)?/)?.[0]); const signal = { symbol: head[1].toUpperCase(), side: head[2].toUpperCase() as 'BUY'|'SELL', entry: value(entry[0]), tp: value(tp[0]), sl: value(sl[0]) };
    if (![signal.entry, signal.tp, signal.sl].every(Number.isFinite)) throw new Error('Entry, TP and SL must be valid prices.');
    if (signal.side === 'BUY' && !(signal.sl < signal.entry && signal.entry < signal.tp)) throw new Error('BUY requires SL < ENTRY < TP.');
    if (signal.side === 'SELL' && !(signal.tp < signal.entry && signal.entry < signal.sl)) throw new Error('SELL requires TP < ENTRY < SL.'); return signal;
  }
  async configure(userId: string, token: string, chatId?: string, environment = 'production') { const verified = await this.testToken(token); const saved = await this.credentials.save(userId, 'telegram', environment, { botToken: token.trim(), chatId: chatId?.trim() || undefined }); await this.start(userId, environment, token.trim(), chatId?.trim()); return { ok: true, bot: verified.bot, saved }; }
  async start(userId: string, environment = 'production', token?: string, chatId?: string) {
    const key = `${userId}:${environment}`; if (this.running.has(key)) return; let botToken = token;
    if (!botToken) { try { const stored = await this.credentials.get(userId, 'telegram', environment); botToken = typeof stored.botToken === 'string' ? stored.botToken : undefined; chatId = chatId ?? (typeof stored.chatId === 'string' ? stored.chatId : undefined); } catch { return; } }
    if (!botToken) return; this.running.add(key);
    const poll = async () => { try { const offset = this.offsets.get(key) ?? 0; const result = await this.telegram(botToken!, 'getUpdates', { offset, timeout: 5, allowed_updates: ['message'] }); if (result.ok) for (const update of result.result ?? []) { this.offsets.set(key, Number(update.update_id) + 1); const message = update.message; if (!message?.text || (chatId && String(message.chat?.id) !== chatId)) continue; try { const signal = this.parseSignal(message.text); const accepted = await this.signals.accept(userId, environment, { ...signal, rawMessage: message.text, telegramUpdateId: Number(update.update_id), telegramChatId: String(message.chat?.id ?? '') }); await this.send(botToken!, String(message.chat.id), `TCE ${signal.symbol} ${signal.side} accepted\nENTRY ${signal.entry}\nTP ${signal.tp}\nSL ${signal.sl}\nStatus: ${accepted.status}`); } catch (error) { await this.send(botToken!, String(message.chat.id), `TCE signal rejected: ${error instanceof Error ? error.message : 'Invalid signal'}`); } } } catch (error) { this.logger.warn(`Telegram polling failed: ${error instanceof Error ? error.message : String(error)}`); } finally { if (this.running.has(key)) this.timers.set(key, setTimeout(poll, 1000)); } }; void poll();
  }
  async stop(userId: string, environment = 'production') { const key = `${userId}:${environment}`; this.running.delete(key); const timer = this.timers.get(key); if (timer) clearTimeout(timer); this.timers.delete(key); await this.credentials.remove(userId, 'telegram', environment); }
  private async send(token: string, chatId: string, text: string) { return this.telegram(token, 'sendMessage', { chat_id: chatId, text }); }
  private async telegram(token: string, method: string, body?: Record<string, unknown>) { const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return response.json() as Promise<any>; }
}
