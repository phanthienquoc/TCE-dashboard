import type {
  CapitalAllocationLifecycle,
  CapitalLifecycleOutcome,
} from '@tce/contracts';
import {
  markAllocationOrphaned,
  markAllocationStuck,
  realizeClosedCapital,
  releaseUnfilledCapital,
  transitionPartialFill,
} from '@tce/contracts';

export type LifecycleCommand = Readonly<{
  idempotencyKey: string;
  timestamp: string;
}>;

export class CapitalAllocationLifecycleService {
  private readonly processed = new Map<string, CapitalAllocationLifecycle>();

  constructor(private current: CapitalAllocationLifecycle) {}

  private run<T extends CapitalLifecycleOutcome>(
    command: LifecycleCommand,
    operation: () => T
  ): T {
    if (!command.idempotencyKey.trim()) {
      return { ok: false, code: 'INVALID_IDEMPOTENCY_KEY', message: 'idempotencyKey is required' } as T;
    }
    const previous = this.processed.get(command.idempotencyKey);
    if (previous) return { ok: true, lifecycle: previous } as T;
    const result = operation();
    if (result.ok) {
      this.current = result.lifecycle;
      this.processed.set(command.idempotencyKey, result.lifecycle);
    }
    return result;
  }

  partialFill(command: LifecycleCommand, filledAmount: number): CapitalLifecycleOutcome {
    return this.run(command, () => transitionPartialFill(this.current, filledAmount, command.timestamp));
  }

  release(command: LifecycleCommand): CapitalLifecycleOutcome {
    return this.run(command, () => releaseUnfilledCapital(this.current, command.timestamp));
  }

  close(command: LifecycleCommand, pnl: number): CapitalLifecycleOutcome {
    return this.run(command, () => realizeClosedCapital(this.current, pnl, command.timestamp));
  }

  orphan(command: LifecycleCommand): CapitalLifecycleOutcome {
    return this.run(command, () => markAllocationOrphaned(this.current, command.timestamp));
  }

  stuck(command: LifecycleCommand): CapitalLifecycleOutcome {
    return this.run(command, () => markAllocationStuck(this.current, command.timestamp));
  }

  snapshot(): CapitalAllocationLifecycle {
    return this.current;
  }
}
