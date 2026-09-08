import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { SsiApplicationService } from '../platform/ssi.application.service';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly ssi: SsiApplicationService,
    private readonly jwt: JwtService
  ) {}
  private userId(auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    return this.jwt.verify(auth.slice(7)).sub;
  }
  @Get() get(@Headers('authorization') auth?: string, @Query('status') status?: string) {
    return this.dashboard.get(this.userId(auth), status);
  }
  @Get('account') getAccount(@Headers('authorization') auth?: string) {
    return this.dashboard.getAccount(this.userId(auth));
  }
  @Get('positions') getPositions(@Headers('authorization') auth?: string) {
    return this.dashboard.getPositions(this.userId(auth));
  }
  @Get('market-prices') async getMarketPrices(
    @Headers('authorization') auth: string | undefined,
    @Query('symbols') symbols?: string
  ) {
    const requestedSymbols = [
      ...new Set(
        String(symbols ?? '')
          .split(',')
          .map(symbol => symbol.trim().toUpperCase())
          .filter(Boolean)
      ),
    ];
    if (!requestedSymbols.length)
      throw new UnauthorizedException('At least one stock symbol is required');
    const result = await this.ssi.marketPrices(this.userId(auth), 'production', requestedSymbols);
    if (!result.ok) return result;
    return {
      ok: true as const,
      data: result.data.map(quote => ({
        symbol: quote.symbol.toUpperCase(),
        price: quote.price,
        tradingDate: quote.tradingDate,
      })),
    };
  }
  @Get('strategy') getStrategy(@Headers('authorization') auth?: string) {
    return this.dashboard.getStrategy(this.userId(auth));
  }
  @Get('pools') getPools(
    @Headers('authorization') auth?: string,
    @Query('status') status?: string
  ) {
    return this.dashboard.getPoolsForUser(this.userId(auth), status);
  }
  @Get('next-positions') getNextPositions(@Headers('authorization') auth?: string) {
    return this.dashboard.getNextPositionsForUser(this.userId(auth));
  }
  @Get('orders') getOrders(@Headers('authorization') auth?: string) {
    return this.dashboard.getOrdersForUser(this.userId(auth));
  }
  @Get('sources') getSources(@Headers('authorization') auth?: string) {
    return this.dashboard.getSources(this.userId(auth));
  }
  @Get('engines') getEngines(@Headers('authorization') auth?: string) {
    return this.dashboard.getEngines(this.userId(auth));
  }
  @Patch('engines/:engineId/status') setEngineStatus(
    @Headers('authorization') auth?: string,
    @Param('engineId') engineId?: string,
    @Body() body?: { status?: string }
  ) {
    return this.dashboard.setEngineStatus(this.userId(auth), engineId ?? '', body?.status ?? '');
  }
  @Get('engine-config') getEngineConfig(@Headers('authorization') auth?: string) {
    return this.dashboard.getEngineConfig(this.userId(auth));
  }
  @Patch('engine-config') setEngineConfig(
    @Headers('authorization') auth?: string,
    @Body() body?: { config?: Record<string, unknown> }
  ) {
    return this.dashboard.setEngineConfig(this.userId(auth), body?.config ?? {});
  }
}
