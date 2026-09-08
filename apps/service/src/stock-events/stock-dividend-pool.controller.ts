import { Controller, Get, Headers, Post, Query, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { StockDividendPoolService } from './stock-dividend-pool.service';

@Controller('stock-events/pool')
export class StockDividendPoolController {
  constructor(
    private readonly pool: StockDividendPoolService,
    private readonly jwt: JwtService
  ) {}

  @Get()
  get(@Headers('authorization') auth?: string, @Query('limit') limit?: string) {
    this.authorize(auth);
    return this.pool.getTop(Number(limit ?? 20));
  }

  @Post('agent/recalculate')
  recalculate(@Headers('authorization') auth?: string, @Query('limit') limit?: string) {
    this.authorize(auth);
    return this.pool.recalculateAndPersist(Number(limit ?? 20));
  }

  private authorize(auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    this.jwt.verify(auth.slice(7));
  }
}
