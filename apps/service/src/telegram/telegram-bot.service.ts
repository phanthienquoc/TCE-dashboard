import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CONTRACT_TOKENS, PlatformCredentialPort, PlatformCredentialRecord } from '@tce/contracts';
import { SupabaseClientService } from '../db/supabase.client';
import { TceSignalService } from '../monitor/tce-signal.service';

export type TceTelegramSignal = { symbol: string; side: 'BUY' | 'SELL'; entry: number; tp: number; sl: number };
export type TelegramDebugLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
const LEVEL_WEIGHT: Record<TelegramDebugLevel, number> = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly offsets = new Map<string, number>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly running = new Set<string>();
  constructor(@Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort, private readonly signals: TceSignalService, private readonly supabase: SupabaseClientService) {}

  async onModuleInit() {
    const rows = await this.credentials.list('00000000-0000-0000-0000-000000000000').catch(() => []);
    void rows;
    const { data, error } = await this.supabase.db.from('platform_credentials').select('id,user_id,environment,credential_name').eq('provider', 'telegram').eq('is_active', true);
    if (error) { this.logger.warn(`Unable to restore Telegram bots: ${error.message}`); return; }
    for (const row of data ?? []) await this.start(String(row.user_id), String(row.environment ?? 'production'), String(row.credential_name ?? 'default'), String(row.id));
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

  async configure(userId: string, token: string, chatId?: string, environment = 'production', name = 'default') {
    const credentialName = this.normalizeName(name); const verified = await this.testToken(token); const saved = await this.credentials.save(userId, 'telegram', environment, { botToken: token.trim(), chatId: chatId?.trim() || undefined }, credentialName);
    this.stopPolling(saved.id); await this.start(userId, environment, credentialName, saved.id, token.trim(), chatId?.trim());
    return { ok: true, bot: verified.bot, saved };
  }

  async listBots(userId: string) {
    return (await this.credentials.list(userId)).filter((row) => row.provider === 'telegram' && row.isActive);
  }

  async removeBot(userId: string, environment = 'production', name = 'default') {
    const bots = await this.listBots(userId); const bot = bots.find((row) => row.environment === environment && row.name === this.normalizeName(name));
    if (bot) this.stopPolling(bot.id);
    await this.credentials.remove(userId, 'telegram', environment, this.normalizeName(name));
  }

  async start(userId: string, environment = 'production', name = 'default', credentialId?: string, token?: string, chatId?: string) {
    const key = credentialId ?? `${userId}:${environment}:${this.normalizeName(name)}`; if (this.running.has(key)) return;
    let botToken = token;
    if (!botToken) { try { const stored = await this.credentials.get(userId, 'telegram', environment, this.normalizeName(name)); botToken = typeof stored.botToken === 'string' ? stored.botToken : undefined; chatId = chatId ?? (typeof stored.chatId === 'string' ? stored.chatId : undefined); } catch { return; } }
    if (!botToken) return; this.running.add(key);
    const poll = async () => { try { const offset = this.offsets.get(key) ?? 0; const result = await this.telegram(botToken!, 'getUpdates', { offset, timeout: 5, allowed_updates: ['message'] }); if (result.ok) for (const update of result.result ?? []) { this.offsets.set(key, Number(update.update_id) + 1); const message = update.message; if (!message?.text || (chatId && String(message.chat?.id) !== chatId)) continue; try { const signal = this.parseSignal(message.text); const accepted = await this.signals.accept(userId, environment, { ...signal, rawMessage: message.text, telegramUpdateId: Number(update.update_id), telegramChatId: String(message.chat?.id ?? '') }); await this.send(botToken!, String(message.chat.id), `TCE ${signal.symbol} ${signal.side} accepted\nENTRY ${signal.entry}\nTP ${signal.tp}\nSL ${signal.sl}\nStatus: ${accepted.status}`); await this.debug(userId, 'telegram', 'INFO', `Signal ${signal.symbol} ${signal.side} accepted`, { environment, bot: name, status: accepted.status }); } catch (error) { const reason = error instanceof Error ? error.message : 'Invalid signal'; await this.send(botToken!, String(message.chat.id), `TCE signal rejected: ${reason}`); await this.debug(userId, 'telegram', 'WARN', `Signal rejected: ${reason}`, { environment, bot: name }); } } } catch (error) { const reason = error instanceof Error ? error.message : String(error); this.logger.warn(`Telegram polling failed: ${reason}`); await this.debug(userId, 'telegram', 'ERROR', `Telegram polling failed: ${reason}`, { environment, bot: name }); } finally { if (this.running.has(key)) this.timers.set(key, setTimeout(poll, 1000)); } }; void poll();
  }

  stopPolling(credentialId: string) { this.running.delete(credentialId); const timer = this.timers.get(credentialId); if (timer) clearTimeout(timer); this.timers.delete(credentialId); this.offsets.delete(credentialId); }
  async stop(userId: string, environment = 'production') { await this.removeBot(userId, environment, 'default'); }

  async listAssignments(userId: string) { const { data, error } = await this.supabase.db.from('telegram_debug_assignments').select('id,telegram_credential_id,service_name,min_level,enabled').eq('user_id', userId).order('service_name'); if (error) throw error; return data ?? []; }

  async assignDebug(userId: string, input: { telegramCredentialId: string; serviceName: string; minLevel?: TelegramDebugLevel; enabled?: boolean }) {
    const serviceName = input.serviceName.trim(); if (!serviceName) throw new Error('Service name is required');
    const { data: bot, error: botError } = await this.supabase.db.from('platform_credentials').select('id').eq('id', input.telegramCredentialId).eq('user_id', userId).eq('provider', 'telegram').eq('is_active', true).maybeSingle(); if (botError) throw botError; if (!bot) throw new Error('Telegram bot not found');
    const { data, error } = await this.supabase.db.from('telegram_debug_assignments').upsert({ user_id: userId, telegram_credential_id: input.telegramCredentialId, service_name: serviceName, min_level: input.minLevel ?? 'INFO', enabled: input.enabled ?? true }, { onConflict: 'user_id,telegram_credential_id,service_name' }).select('id,telegram_credential_id,service_name,min_level,enabled').single(); if (error) throw error; return data;
  }

  async removeAssignment(userId: string, assignmentId: string) { const { error } = await this.supabase.db.from('telegram_debug_assignments').delete().eq('id', assignmentId).eq('user_id', userId); if (error) throw error; }

  async debug(userId: string, serviceName: string, level: TelegramDebugLevel, message: string, context?: Record<string, unknown>) {
    try {
      const { data: assignments, error } = await this.supabase.db.from('telegram_debug_assignments').select('telegram_credential_id,service_name,min_level').eq('user_id', userId).eq('enabled', true).in('service_name', [serviceName, '*']);
      if (error || !assignments?.length) return;
      const selected = new Map<string, { service_name: string; min_level: TelegramDebugLevel }>();
      for (const row of assignments) { const minLevel = row.min_level as TelegramDebugLevel; if (LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[minLevel]) selected.set(String(row.telegram_credential_id), { service_name: String(row.service_name), min_level: minLevel }); }
      for (const credentialId of selected.keys()) {
        const { data: row } = await this.supabase.db.from('platform_credentials').select('user_id,environment,credential_name').eq('id', credentialId).eq('user_id', userId).eq('provider', 'telegram').eq('is_active', true).maybeSingle();
        if (!row) continue;
        const stored = await this.credentials.get(userId, 'telegram', String(row.environment), String(row.credential_name ?? 'default'));
        const botToken = typeof stored.botToken === 'string' ? stored.botToken : ''; const chatId = typeof stored.chatId === 'string' ? stored.chatId : '';
        if (!botToken || !chatId) continue;
        const suffix = context && Object.keys(context).length ? `\n${JSON.stringify(context)}` : ''; await this.send(botToken, chatId, `[${level}] ${serviceName}\n${message}${suffix}`);
      }
    } catch (error) { this.logger.debug(`Telegram debug delivery skipped: ${error instanceof Error ? error.message : String(error)}`); }
  }

  private normalizeName(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 64) || 'default'; }
  private async send(token: string, chatId: string, text: string) { return this.telegram(token, 'sendMessage', { chat_id: chatId, text }); }
  private async telegram(token: string, method: string, body?: Record<string, unknown>) { const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return response.json() as Promise<any>; }
}
