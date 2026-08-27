import { Injectable, Logger } from '@nestjs/common';
import { CONTRACT_TOKENS, PlatformCredentialPort } from '@tce/contracts';
import { Inject } from '@nestjs/common';
import { TceEngineService } from '../monitor/tce-engine.service';

export type TceTelegramSignal = { symbol: string; side: 'BUY' | 'SELL'; entry: number; tp: number; sl: number };

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly offsets = new Map<string, number>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly running = new Set<string>();

  constructor(@Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort, private readonly engine: TceEngineService) {}

  parseSignal(text: string): TceTelegramSignal {
    const normalized = text.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
    const lines = normalized.split(/\n|(?=ENTRY\s)|(?=TP\s)|(?=SL\s)/i).map((x) => x.trim()).filter(Boolean);
    const source = lines.join('\n');
    const head = source.match(/^([A-Z0-9._-]+)\s+(BUY|SELL)\b/i);
    const entry = source.match(/\bENTRY\s+([0-9]+(?:\.[0-9]+)?)\b/i);
    const tp = source.match(/\bTP\s+([0-9]+(?:\.[0-9]+)?)\b/i);
    const sl = source.match(/\bSL\s+([0-9]+(?:\.[0-9]+)?)\b/i);
    if (!head || !entry || !tp || !sl) throw new Error('Invalid TCE signal. Expected SYMBOL SIDE / ENTRY price / TP price / SL price.');
    if (/\bTP\s+[0-9.]+\s+[0-9.]+/i.test(source) || /\bTP\s+[0-9.]+\s+TP\b/i.test(source)) throw new Error('Exactly one TP is allowed.');
    if (source.match(/\bENTRY\s+[0-9.]+\s*[-_]\s*[0-9.]+/i)) throw new Error('Entry must contain exactly one price; ranges are not accepted.');
    const signal: TceTelegramSignal = { symbol: head[1].toUpperCase(), side: head[2].toUpperCase() as 'BUY' | 'SELL', entry: Number(entry[1]), tp: Number(tp[1]), sl: Number(sl[1]) };
    if (signal.side === 'BUY' && !(signal.sl < signal.entry && signal.entry < signal.tp)) throw new Error('BUY requires SL < ENTRY < TP.');
    if (signal.side === 'SELL' && !(signal.tp < signal.entry && signal.entry < signal.sl)) throw new Error('SELL requires TP < ENTRY < SL.');
    return signal;
  }

  async configure(userId: string, token: string, chatId?: string, environment = 'production') {
    if (!token.trim()) throw new Error('Telegram bot token is required');
    const me = await this.telegram(token, 'getMe');
    if (!me.ok) throw new Error(me.description ?? 'Telegram token is invalid');
    const credentials = { botToken: token.trim(), chatId: chatId?.trim() || undefined };
    const saved = await this.credentials.save(userId, 'telegram' as any, environment, credentials);
    await this.start(userId, environment, token.trim(), chatId?.trim());
    return { ok: true, bot: me.result, saved };
  }

  async start(userId: string, environment = 'production', token?: string, chatId?: string) {
    const key = `${userId}:${environment}`;
    if (this.running.has(key)) return;
    let botToken = token;
    if (!botToken) {
      const rows = await this.credentials.list(userId);
      const row = (rows as any[]).find((item) => item.provider === 'telegram' && item.environment === environment);
      botToken = row?.credentials?.botToken;
      chatId = chatId ?? row?.credentials?.chatId;
    }
    if (!botToken) return;
    this.running.add(key);
    const poll = async () => {
      try {
        const offset = this.offsets.get(key) ?? 0;
        const result = await this.telegram(botToken!, 'getUpdates', { offset, timeout: 5, allowed_updates: ['message'] });
        if (result.ok) for (const update of result.result ?? []) {
          this.offsets.set(key, Number(update.update_id) + 1);
          const message = update.message;
          if (!message?.text) continue;
          if (chatId && String(message.chat?.id) !== chatId) continue;
          try {
            const signal = this.parseSignal(message.text);
            const execution = await this.engine.submitSignal(userId, environment, signal);
            await this.send(botToken!, String(message.chat.id), `TCE ${signal.symbol} ${signal.side} accepted\\nENTRY ${signal.entry}\\nTP ${signal.tp}\\nSL ${signal.sl}\\nStatus: ${execution.status}`);
          } catch (error) {
            await this.send(botToken!, String(message.chat.id), `TCE signal rejected: ${error instanceof Error ? error.message : 'Invalid signal'}`);
          }
        }
      } catch (error) { this.logger.warn(`Telegram polling failed: ${error instanceof Error ? error.message : String(error)}`); }
      finally { if (this.running.has(key)) this.timers.set(key, setTimeout(poll, 1000)); }
    };
    void poll();
  }

  async stop(userId: string, environment = 'production') {
    const key = `${userId}:${environment}`;
    this.running.delete(key);
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
  }

  private async send(token: string, chatId: string, text: string) { return this.telegram(token, 'sendMessage', { chat_id: chatId, text }); }
  private async telegram(token: string, method: string, body?: Record<string, unknown>) {
    const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return response.json() as Promise<any>;
  }
}
