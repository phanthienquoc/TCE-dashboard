import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { DividendOhlcvService } from '../stock-events/dividend-ohlcv.service';

@Controller('dashboard')
export class DashboardPriceHistoryController {
  constructor(
    private readonly jwt: JwtService,
    private readonly ohlcv: DividendOhlcvService,
  ) {}

  @Get('price-history')
  async getPriceHistory(
    @Headers('authorization') authorization: string | undefined,
    @Query('symbol') symbol?: string,
    @Query('days') days?: string,
  ) {
    this.requireAuth(authorization);
    return {
      ok: true as const,
      data: await this.ohlcv.getHistory(String(symbol ?? ''), Number(days ?? 365)),
    };
  }

  private requireAuth(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    this.jwt.verify(authorization.slice(7));
  }
}
