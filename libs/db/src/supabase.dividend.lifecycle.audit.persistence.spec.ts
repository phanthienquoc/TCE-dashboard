import { SupabaseDividendLifecycleAuditPersistence } from './supabase.dividend.lifecycle.audit.persistence';

const evidence = {
  accountId: 'account-1',
  environment: 'PAPER' as const,
  eventId: 'div-1',
  symbol: 'ABC',
  state: 'ANNOUNCED' as const,
  observedAt: '2026-09-14T02:00:00.000Z',
  sourceRevision: 'provider-1',
  authoritative: true,
  evidenceHash: 'hash-1',
  auditId: 'account-1:PAPER:div-1:hash-1',
};

function createMockDb() {
  const rows: Record<string, unknown>[] = [];
  return {
    rows,
    from() {
      const state: { filters: Record<string, string>; orderBy: string[]; insertRow?: Record<string, unknown> } = {
        filters: {},
        orderBy: [],
      };
      const builder = {
        select() { return builder; },
        eq(column: string, value: string) { state.filters[column] = value; return builder; },
        order(column: string) { state.orderBy.push(column); return builder; },
        insert(value: Record<string, unknown>) {
          state.insertRow = value;
          if (rows.some(row => row.audit_id === value.audit_id)) {
            return Promise.resolve({ error: { code: '23505' } });
          }
          rows.push(value);
          return Promise.resolve({ error: null });
        },
        then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
          const filtered = rows.filter(row =>
            Object.entries(state.filters).every(([key, value]) => row[key] === value),
          );
          filtered.sort((a, b) => String(a.observed_at).localeCompare(String(b.observed_at)) || String(a.audit_id).localeCompare(String(b.audit_id)));
          return Promise.resolve(resolve({ data: filtered, error: null }));
        },
      };
      return builder;
    },
  };
}

test('appends and lists durable lifecycle audit evidence in deterministic order', async () => {
  const db = createMockDb();
  const repository = new SupabaseDividendLifecycleAuditPersistence(db as never);

  await expect(repository.append(evidence)).resolves.toBe('APPENDED');
  await expect(repository.list('account-1', 'PAPER', 'div-1')).resolves.toEqual([evidence]);
});

test('duplicate audit evidence is idempotent', async () => {
  const db = createMockDb();
  const repository = new SupabaseDividendLifecycleAuditPersistence(db as never);

  await repository.append(evidence);
  await expect(repository.append(evidence)).resolves.toBe('DUPLICATE');
  expect(db.rows).toHaveLength(1);
});

test('orders persisted evidence by observedAt then auditId', async () => {
  const db = createMockDb();
  const repository = new SupabaseDividendLifecycleAuditPersistence(db as never);
  const later = { ...evidence, auditId: 'later', evidenceHash: 'hash-2', observedAt: '2026-09-15T02:00:00.000Z' };
  const earlier = { ...evidence, auditId: 'earlier', evidenceHash: 'hash-3', observedAt: '2026-09-13T02:00:00.000Z' };

  await repository.append(later);
  await repository.append(earlier);
  await expect(repository.list('account-1', 'PAPER', 'div-1')).resolves.toEqual([earlier, later]);
});

test('fails closed for incomplete identity or non-authoritative evidence', async () => {
  const db = createMockDb();
  const repository = new SupabaseDividendLifecycleAuditPersistence(db as never);

  await expect(repository.list('', 'PAPER', 'div-1')).rejects.toThrow('accountId, environment and eventId are required');
  await expect(repository.append({ ...evidence, authoritative: false })).rejects.toThrow('authoritative evidence is required');
});
