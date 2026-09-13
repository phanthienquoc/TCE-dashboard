import type { LocalPosition } from './position-state-reconciler';

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
    if (!snapshot.recordedAt.trim()) return;
    this.latest = {
      recordedAt: snapshot.recordedAt,
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

export function rebuildPositionOwnership(
  positions: readonly LocalPosition[]
): RebuiltOwnership[] {
  const seen = new Set<string>();
  const ownership: RebuiltOwnership[] = [];

  for (const position of positions) {
    const symbol = position.symbol.trim().toUpperCase();
    if (!symbol || position.quantity <= 0 || position.avgCost <= 0) continue;
    const ownerKey = position.id.trim() || symbol;
    if (seen.has(ownerKey)) continue;
    seen.add(ownerKey);
    ownership.push({
      slotId: position.slotId,
      pool: position.pool,
      ownerKey,
      quantity: position.quantity,
      capital: position.quantity * position.avgCost,
    });
  }

  return ownership.sort((a, b) => a.ownerKey.localeCompare(b.ownerKey));
}

export async function recoverPositions(
  persistence: PositionRecoveryPersistencePort
): Promise<readonly LocalPosition[]> {
  const snapshot = await persistence.getLatest();
  if (!snapshot) return [];
  return snapshot.positions.map(position => ({ ...position }));
}
