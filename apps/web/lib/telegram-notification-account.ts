/**
 * A React key for account-local Telegram notification page state.
 * Changing identity remounts the subtree, discarding the previous account's
 * bot/assignment list and letting the old effect cleanup abort pending reads.
 */
export function telegramNotificationAccountKey(userId: string | null | undefined): string {
  return userId ?? 'anonymous';
}
