import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CONTRACT_TOKENS, PlatformCredentialPort } from '@tce/contracts';
import { SupabaseClientService } from '../db/supabase.client';

export type TelegramDebugLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
const LEVEL_WEIGHT: Record<TelegramDebugLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

@Injectable()
export class TelegramDebugService {
  private readonly logger = new Logger(TelegramDebugService.name);
  constructor(
    @Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort,
    private readonly supabase: SupabaseClientService
  ) {}

  async emit(
    userId: string,
    serviceName: string,
    level: TelegramDebugLevel,
    message: string,
    context?: Record<string, unknown>
  ) {
    try {
      const { data: assignments, error } = await this.supabase.db
        .from('telegram_debug_assignments')
        .select('telegram_credential_id,min_level')
        .eq('user_id', userId)
        .eq('enabled', true)
        .in('service_name', [serviceName, '*']);
      if (error || !assignments?.length) return;
      const selected = new Set<string>();
      for (const row of assignments) {
        const minLevel = row.min_level as TelegramDebugLevel;
        if (LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[minLevel])
          selected.add(String(row.telegram_credential_id));
      }
      for (const credentialId of selected) {
        const { data: bot } = await this.supabase.db
          .from('platform_credentials')
          .select('environment,credential_name')
          .eq('id', credentialId)
          .eq('user_id', userId)
          .eq('provider', 'telegram')
          .eq('is_active', true)
          .maybeSingle();
        if (!bot) continue;
        const stored = await this.credentials.get(
          userId,
          'telegram',
          String(bot.environment),
          String(bot.credential_name ?? 'default')
        );
        const token = typeof stored.botToken === 'string' ? stored.botToken : '';
        const chatId = typeof stored.chatId === 'string' ? stored.chatId : '';
        if (!token || !chatId) continue;
        const suffix = context && Object.keys(context).length ? `\n${JSON.stringify(context)}` : '';
        await this.send(token, chatId, `[${level}] ${serviceName}\n${message}${suffix}`);
      }
    } catch (error) {
      this.logger.debug(
        `Telegram debug delivery skipped: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async send(token: string, chatId: string, text: string) {
    const response = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );
    if (!response.ok) throw new Error(`Telegram sendMessage HTTP ${response.status}`);
  }
}
