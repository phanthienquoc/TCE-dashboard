import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { DividendOhlcvService } from './dividend-ohlcv.service';

@Controller('dashboard')
export class DividendOhlcvController {
  constructor(
    private readonly jwt: JwtService,
    private readonly service: DividendOhlcvService
  ) {}

  @Get('price-history')
  async history(
    @Headers('authorization') authorization: string | undefined,
    @Query('symbol') symbol?: string,
    @Query('days') days?: string
  ) {
    const userId = this.userId(authorization);
    return {
      ok: true,
      data: await this.service.getHistory(symbol ?? '', Number(days ?? 365)),
      userId,
    };
  }

  @Get('dividend-ohlcv-sync-progress')
  async syncProgress(@Headers('authorization') authorization: string | undefined) {
    return { ok: true, data: await this.service.latestSyncProgress(this.userId(authorization)) };
  }

  private userId(authorization?: string) {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException('Bearer token required');
    return String(this.jwt.verify(authorization.slice(7)).sub);
  }
}
