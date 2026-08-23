import { Injectable } from '@nestjs/common';

/**
 * Keeps the TCE boundary explicit:
 * Pool 5 is research/ranking state; buy_candidates is execution intent.
 * A future scanner should call promote() only after a pool entry passes the
 * execution gate. The actual position-capacity check remains in the monitor.
 */
@Injectable()
export class PoolCandidateService {
  shouldPromote(input: { poolStatus: string; openSlots: number; score?: number | null }) {
    return input.poolStatus === 'TRIGGERED' && input.openSlots > 0 && (input.score ?? 0) > 0;
  }
}
