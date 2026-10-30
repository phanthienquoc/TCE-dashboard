/**
 * A React key for account-local Telegram configuration UI state.
 * Changing identity remounts the subtree, aborting effect-owned reads and
 * discarding old-account form, bot, and assignment state before it can render.
 */
export function telegramBotConfigAccountKey(userId: string | null | undefined): string {
  return userId ?? 'anonymous';
}
