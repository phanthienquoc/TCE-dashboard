import { normalizeApiError } from './api-errors';

export type TelegramBotConfigOperation = 'load' | 'save' | 'pause' | 'remove' | 'assign' | 'unassign';

const FALLBACK_MESSAGES: Record<TelegramBotConfigOperation, string> = {
  load: 'Unable to load Telegram bot configuration.',
  save: 'Unable to save Telegram bot.',
  pause: 'Unable to change Telegram state.',
  remove: 'Unable to disconnect bot.',
  assign: 'Unable to assign debug routing.',
  unassign: 'Unable to remove debug routing.',
};

/** Return a stable, user-safe message without exposing arbitrary backend details. */
export function normalizeTelegramBotConfigError(
  error: unknown,
  operation: TelegramBotConfigOperation
): string {
  return normalizeApiError(error, FALLBACK_MESSAGES[operation]).message;
}
