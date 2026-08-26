import { Inject, Injectable } from '@nestjs/common';
import { CONTRACT_TOKENS, PositionRepository } from '@tce/contracts';
import { TceDecision, TceEngine } from '@tce/tce-engine';

@Injectable()
export class TceEngineService {
  private readonly engine = new TceEngine();

  constructor(
    @Inject(CONTRACT_TOKENS.positionRepository)
    private readonly positions: PositionRepository,
  ) {}

  async evaluateAccount(accountId: string): Promise<TceDecision[]> {
    const positions = await this.positions.listOpen(accountId);
    return this.engine.evaluateMany(positions);
  }
}
