import { platformApi } from './api';

export type TelegramBotSummary = {
  id: string;
  name: string;
  environment: string;
  isActive: boolean;
  isPaused?: boolean;
};

export type TelegramDebugAssignment = {
  id: string;
  telegram_credential_id: string;
  service_name: string;
  min_level: string;
  enabled: boolean;
};

function normalizeBots(data: unknown): TelegramBotSummary[] {
  const payload = data as { bots?: unknown } | null;
  const rows = payload?.bots ?? data ?? [];
  return Array.isArray(rows) ? (rows as TelegramBotSummary[]) : [];
}

function normalizeAssignments(data: unknown): TelegramDebugAssignment[] {
  const payload = data as { assignments?: unknown } | null;
  const rows = Array.isArray(data) ? data : (payload?.assignments ?? []);
  return Array.isArray(rows) ? (rows as TelegramDebugAssignment[]) : [];
}

/** Fetch bot summaries with the caller's route/account lifecycle signal. */
export async function loadTelegramBots(signal?: AbortSignal): Promise<TelegramBotSummary[]> {
  const response = await platformApi.telegramBots(signal);
  return normalizeBots(response.data);
}

/** Fetch the paired bot and debug-assignment view with one cancellation scope. */
export async function loadTelegramNotificationData(
  signal?: AbortSignal
): Promise<{ bots: TelegramBotSummary[]; assignments: TelegramDebugAssignment[] }> {
  const [botsResponse, assignmentsResponse] = await Promise.all([
    platformApi.telegramBots(signal),
    platformApi.telegramDebugAssignments(signal),
  ]);

  return {
    bots: normalizeBots(botsResponse.data),
    assignments: normalizeAssignments(assignmentsResponse.data),
  };
}
