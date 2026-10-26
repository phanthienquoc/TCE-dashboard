import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isTceRuntimeEvent,
  type TceEventPublisherPort,
  type TceRuntimeEvent,
} from '@tce/contracts';
import { createMonitorSnapshotEvent, publishMonitorSnapshotBestEffort } from './monitor-event.js';

const REPLAY_TABLE = 'tce_monitor_event_replay';
const REPLAY_BATCH_LIMIT = 100;
const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 15 * 60_000;

type ReplayRow = {
  snapshot_id: string;
  event_id: string;
  position_id: string;
  account_id: string;
  symbol: string;
  signal: string;
  occurred_at: string;
  correlation_id: string;
  attempt_count: number;
};

export type MonitorEventReplayResult = Readonly<{
  scanned: number;
  delivered: number;
  retried: number;
  deadLettered: number;
  storeUnavailable: boolean;
}>;

type WarningHandler = (message: string) => void;

export function safeReplayErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '');
    if (/^[A-Za-z0-9_-]{1,40}$/.test(code)) return code;
  }
  if (error instanceof Error && /^[A-Za-z0-9_-]{1,40}$/.test(error.name)) return error.name;
  return 'PUBLISH_FAILED';
}

function retryDelayMs(failedAttempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, failedAttempts - 1));
}

async function updateReplayOutcome(
  db: SupabaseClient,
  snapshotId: string,
  expectedAttempts: number,
  published: boolean,
  failure: unknown,
  warn: WarningHandler,
  now: Date
): Promise<'delivered' | 'pending' | 'dead_letter' | 'state_update_failed' | 'state_update_raced'> {
  const attemptCount = expectedAttempts + 1;
  const nowIso = now.toISOString();
  const state = published ? 'delivered' : attemptCount >= MAX_ATTEMPTS ? 'dead_letter' : 'pending';
  const nextAttemptAt =
    state === 'pending' ? new Date(now.getTime() + retryDelayMs(attemptCount)).toISOString() : null;

  const update = {
    state,
    attempt_count: attemptCount,
    next_attempt_at: nextAttemptAt,
    last_error_code: published ? null : safeReplayErrorCode(failure),
    delivered_at: published ? nowIso : null,
    dead_lettered_at: state === 'dead_letter' ? nowIso : null,
  };

  try {
    const { data, error } = await db
      .from(REPLAY_TABLE)
      .update(update)
      .eq('snapshot_id', snapshotId)
      .eq('state', 'pending')
      .eq('attempt_count', expectedAttempts)
      .select('snapshot_id')
      .maybeSingle();

    if (error) {
      warn(`replay_state_update_failed:${safeReplayErrorCode(error)}`);
      return 'state_update_failed';
    }
    if (!data) return 'state_update_raced';
    return state;
  } catch (error) {
    warn(`replay_state_update_failed:${safeReplayErrorCode(error)}`);
    return 'state_update_failed';
  }
}

/**
 * Persists an event with a stable ID, then records the attempt in the snapshot
 * replay queue. If the event write succeeds but the state write fails, the row
 * remains pending; a replay is safe because duplicate event IDs are idempotent.
 */
export async function publishMonitorSnapshotWithReplay(
  db: SupabaseClient,
  publisher: TceEventPublisherPort,
  snapshotId: string,
  event: TceRuntimeEvent<'monitor.snapshot.created'>,
  warn: WarningHandler,
  now = new Date()
): Promise<'delivered' | 'pending' | 'dead_letter' | 'state_update_failed' | 'state_update_raced'> {
  let failure: unknown;
  const published = await publishMonitorSnapshotBestEffort(publisher, event, error => {
    failure = error;
  });

  if (!published) warn(`monitor_event_publish_failed:${safeReplayErrorCode(failure)}`);
  const result = await updateReplayOutcome(db, snapshotId, 0, published, failure, warn, now);
  if (result === 'dead_letter') warn(`monitor_event_dead_lettered:${snapshotId}`);
  return result;
}

async function deadLetterInvalidRow(
  db: SupabaseClient,
  row: ReplayRow,
  warn: WarningHandler,
  now: Date
): Promise<boolean> {
  try {
    const { data, error } = await db
      .from(REPLAY_TABLE)
      .update({
        state: 'dead_letter',
        attempt_count: row.attempt_count + 1,
        next_attempt_at: null,
        last_error_code: 'INVALID_REPLAY_PAYLOAD',
        delivered_at: null,
        dead_lettered_at: now.toISOString(),
      })
      .eq('snapshot_id', row.snapshot_id)
      .eq('state', 'pending')
      .eq('attempt_count', row.attempt_count)
      .select('snapshot_id')
      .maybeSingle();
    if (error) {
      warn(`replay_invalid_row_dead_letter_failed:${safeReplayErrorCode(error)}`);
      return false;
    }
    return Boolean(data);
  } catch (error) {
    warn(`replay_invalid_row_dead_letter_failed:${safeReplayErrorCode(error)}`);
    return false;
  }
}

/**
 * Replays a bounded batch of due monitor events. Snapshot insert and replay-row
 * creation are atomic via the database trigger; event storage uses a stable
 * event_id, and state updates use compare-and-set to tolerate concurrent runs.
 */
export async function replayPendingMonitorSnapshotEvents(
  db: SupabaseClient,
  publisher: TceEventPublisherPort,
  warn: WarningHandler,
  now = new Date()
): Promise<MonitorEventReplayResult> {
  let rows: ReplayRow[];
  try {
    const { data, error } = await db
      .from(REPLAY_TABLE)
      .select(
        'snapshot_id,event_id,position_id,account_id,symbol,signal,occurred_at,correlation_id,attempt_count'
      )
      .eq('state', 'pending')
      .lte('next_attempt_at', now.toISOString())
      .order('next_attempt_at', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(REPLAY_BATCH_LIMIT);

    if (error) {
      warn(`replay_queue_unavailable:${safeReplayErrorCode(error)}`);
      return { scanned: 0, delivered: 0, retried: 0, deadLettered: 0, storeUnavailable: true };
    }
    rows = (data ?? []) as ReplayRow[];
  } catch (error) {
    warn(`replay_queue_unavailable:${safeReplayErrorCode(error)}`);
    return { scanned: 0, delivered: 0, retried: 0, deadLettered: 0, storeUnavailable: true };
  }

  let delivered = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const row of rows) {
    const event = createMonitorSnapshotEvent({
      snapshotId: row.snapshot_id,
      positionId: row.position_id,
      accountId: row.account_id,
      symbol: row.symbol,
      signal: row.signal,
      occurredAt: row.occurred_at,
      correlationId: row.correlation_id,
    });

    if (
      row.event_id !== `monitor.snapshot.created:${row.snapshot_id}` ||
      !isTceRuntimeEvent(event)
    ) {
      if (await deadLetterInvalidRow(db, row, warn, now)) deadLettered += 1;
      continue;
    }

    let failure: unknown;
    const published = await publishMonitorSnapshotBestEffort(publisher, event, error => {
      failure = error;
    });
    if (!published) warn(`monitor_event_replay_failed:${safeReplayErrorCode(failure)}`);

    const outcome = await updateReplayOutcome(
      db,
      row.snapshot_id,
      row.attempt_count,
      published,
      failure,
      warn,
      now
    );

    if (outcome === 'delivered') delivered += 1;
    else if (outcome === 'pending') retried += 1;
    else if (outcome === 'dead_letter') {
      deadLettered += 1;
      warn(`monitor_event_dead_lettered:${row.snapshot_id}`);
    }
  }

  return { scanned: rows.length, delivered, retried, deadLettered, storeUnavailable: false };
}
