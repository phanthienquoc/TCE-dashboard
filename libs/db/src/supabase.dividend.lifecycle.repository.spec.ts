import { SupabaseDividendLifecycleRepository } from './supabase.dividend.lifecycle.repository';

type QueryResult = { data?: unknown; error?: { code?: string } | null };

test('saves and reloads the canonical dividend lifecycle record', async () => {
  let row: Record<string, unknown> | undefined;
  const db = createMockDb(() => row, value => { row = value; });
  const repository = new SupabaseDividendLifecycleRepository(db as never);
  const record = {
    accountId: 'account-1',
    environment: 'PAPER',
    symbol: 'ABC',
    eventId: 'div-1',
    lifecycle: 'ELIGIBLE' as const,
    exDividendAt: '2026-09-20T00:00:00.000Z',
    recordAt: '2026-09-21T00:00:00.000Z',
    paymentAt: '2026-09-30T00:00:00.000Z',
    source: 'provider',
    sourceVersion: 'v1',
    updatedAt: '2026-09-14T02:00:00.000Z',
  };

  await expect(repository.save(record)).resolves.toEqual(record);
  await expect(repository.get('account-1', 'PAPER', 'div-1')).resolves.toEqual(record);
});

test('repeated save is idempotent at the identity boundary', async () => {
  let row: Record<string, unknown> | undefined;
  const db = createMockDb(() => row, value => { row = value; });
  const repository = new SupabaseDividendLifecycleRepository(db as never);
  const first = {
    accountId: 'account-1', environment: 'PAPER', symbol: 'ABC', eventId: 'div-1',
    lifecycle: 'ANNOUNCED' as const, exDividendAt: '2026-09-20T00:00:00.000Z',
    source: 'provider', updatedAt: '2026-09-14T02:00:00.000Z',
  };
  const second = { ...first, lifecycle: 'EX_DIVIDEND' as const, updatedAt: '2026-09-21T02:00:00.000Z' };

  await repository.save(first);
  await expect(repository.save(second)).resolves.toEqual(second);
  await expect(repository.get('account-1', 'PAPER', 'div-1')).resolves.toEqual(second);
});

test('fails closed when identity is incomplete', async () => {
  const db = createMockDb(() => undefined, () => undefined);
  const repository = new SupabaseDividendLifecycleRepository(db as never);
  await expect(repository.get('', 'PAPER', 'div-1')).rejects.toThrow('accountId, environment and eventId are required');
  await expect(repository.save({
    accountId: 'account-1', environment: '', symbol: 'ABC', eventId: 'div-1',
    lifecycle: 'ANNOUNCED', exDividendAt: '2026-09-20T00:00:00.000Z', source: 'provider',
    updatedAt: '2026-09-14T02:00:00.000Z',
  })).rejects.toThrow('accountId, environment and eventId are required');
});

function createMockDb(read: () => Record<string, unknown> | undefined, write: (row: Record<string, unknown>) => void) {
  return {
    from() {
      const state: { filters: Record<string, string>; upsertRow?: Record<string, unknown> } = { filters: {} };
      const builder = {
        select() { return builder; },
        eq(column: string, value: string) { state.filters[column] = value; return builder; },
        maybeSingle() {
          const current = read();
          const matches = current && Object.entries(state.filters).every(([key, value]) => current[key] === value);
          return Promise.resolve({ data: matches ? current : null, error: null } satisfies QueryResult);
        },
        upsert(value: Record<string, unknown>) { state.upsertRow = value; return builder; },
        single() {
          if (state.upsertRow) write(state.upsertRow);
          return Promise.resolve({ data: state.upsertRow ?? null, error: null } satisfies QueryResult);
        },
      };
      return builder;
    },
  };
}
