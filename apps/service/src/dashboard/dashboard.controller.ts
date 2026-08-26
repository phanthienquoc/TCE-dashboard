import { Body, Controller, Get, Headers, Param, Patch, Query, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService, private readonly jwt: JwtService) {}

  private userId(auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    return this.jwt.verify(auth.slice(7)).sub;
  }

  @Get()
  get(@Headers('authorization') auth?: string, @Query('status') status?: string) {
    return this.dashboard.get(this.userId(auth), status);
  }

  @Get('account')
  getAccount(@Headers('authorization') auth?: string) {
    return this.dashboard.getAccount(this.userId(auth));
  }

  @Get('positions')
  getPositions(@Headers('authorization') auth?: string) {
    return this.dashboard.getPositions(this.userId(auth));
  }

  @Get('strategy')
  getStrategy(@Headers('authorization') auth?: string) {
    return this.dashboard.getStrategy(this.userId(auth));
  }

  @Get('pools')
  getPools(@Headers('authorization') auth?: string, @Query('status') status?: string) {
    return this.dashboard.getPoolsForUser(this.userId(auth), status);
  }

  @Get('next-positions')
  getNextPositions(@Headers('authorization') auth?: string) {
    return this.dashboard.getNextPositionsForUser(this.userId(auth));
  }

  @Get('orders')
  getOrders(@Headers('authorization') auth?: string) {
    return this.dashboard.getOrdersForUser(this.userId(auth));
  }

  @Get('sources')
  getSources(@Headers('authorization') auth?: string) {
    return this.dashboard.getSources(this.userId(auth));
  }

  @Get('engines')
  getEngines(@Headers('authorization') auth?: string) {
    return this.dashboard.getEngines(this.userId(auth));
  }

  @Patch('engines/:engineId/status')
  setEngineStatus(
    @Headers('authorization') auth?: string,
    @Param('engineId') engineId?: string,
    @Body() body?: { status?: string },
  ) {
    return this.dashboard.setEngineStatus(this.userId(auth), engineId ?? '', body?.status ?? '');
  }
}
