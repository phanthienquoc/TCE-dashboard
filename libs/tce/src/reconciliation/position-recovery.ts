import { assertValidLocalPosition, normalizePositionSymbol, type LocalPosition } from './position-state-reconciler';

export type PositionRecoverySnapshot = Readonly<{
  recordedAt: string;
  positions: readonly LocalPosition[];
}>;

export interface PositionRecoveryPersistencePort {
  save(snapshot: PositionRecoverySnapshot): Promise<void>;
  getLatest(): Promise<PositionRecoverySnapshot | undefined>;
}

export class InMemoryPositionRecoveryPersistence implements PositionRecoveryPersistencePort {
  private latest?: PositionRecoverySnapshot;

  async save(snapshot: PositionRecoverySnapshot): Promise<void> {
    if (!Number.isFinite(Date.parse(snapshot.recordedAt))) {
      throw new Error('Position recovery recordedAt must be a valid timestamp.');
    }
    for (const position of snapshot.positions) assertValidLocalPosition(position);
    this.latest = {
      recordedAt: new Date(snapshot.recordedAt).toISOString(),
      positions: snapshot.positions.map(position => ({ ...position })),
    };
  }

  async getLatest(): Promise<PositionRecoverySnapshot | undefined> {
    return this.latest
      ? {
          recordedAt: this.latest.recordedAt,
          positions: this.latest.positions.map(position => ({ ...position })),
        }
      : undefined;
  }
}

export type RebuiltOwnership = Readonly<{
  slotId?: string;
  pool?: 'A' | 'B' | 'C';
  ownerKey: string;
  quantity: number;
  capital: number;
}>;

export function rebuildPositionOwnership(positions: readonly LocalPosition[]): RebuiltOwnership[] {
  const seenOwnerKeys = new Set<string>();
  const seenSymbols = new Set<string>();
  const ownership: RebuiltOwnership[] = [];

  for (const position of positions) {
    assertValidLocalPosition(position);
    if (position.status === 'CLOSED') continue;

    const symbol = normalizePositionSymbol(position.symbol);
    const ownerKey = position.id.trim();
    if (seenOwnerKeys.has(ownerKey) || seenSymbols.has(symbol)) {
      throw new Error(`Duplicate position ownership detected for ${symbol}.`);
    }

    const capital = position.quantity * position.avgCost;
    if (!Number.isFinite(capital)) {
      throw new Error(`Position capital is not finite for ${symbol}.`);
    }

    seenOwnerKeys.add(ownerKey);
    seenSymbols.add(symbol);
    ownership.push({
      slotId: position.slotId,
      pool: position.pool,
      ownerKey,
      quantity: position.quantity,
      capital,
    });
  }

  return ownership.sort((a, b) => a.ownerKey.localeCompare(b.ownerKey));
}

export class PositionRecoveryUnavailableError extends Error {
  constructor() {
    super('Authoritative position recovery snapshot is unavailable.');
    this.name = 'PositionRecoveryUnavailableError';
  }
}

export async function recoverPositions(
  persistence: PositionRecoveryPersistencePort
): Promise<readonly LocalPosition[]> {
  const snapshot = await persistence.getLatest();
  if (!snapshot) throw new PositionRecoveryUnavailableError();
  if (!Number.isFinite(Date.parse(snapshot.recordedAt))) {
    throw new Error('Position recovery snapshot timestamp is invalid.');
  }
  for (const position of snapshot.positions) assertValidLocalPosition(position);
  return snapshot.positions.map(position => ({ ...position }));
}
