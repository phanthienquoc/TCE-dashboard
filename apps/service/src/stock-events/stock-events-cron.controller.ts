import { Body, Controller, Get, Headers, Post, Query, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { StockEventsCronService } from './stock-events-cron.service';

@Controller('stock-events-cron')
export class StockEventsCronController {
  constructor(
    private readonly cron: StockEventsCronService,
    private readonly jwt: JwtService,
  ) {}

  private userId(auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    const payload = this.jwt.verify(auth.slice(7));
    if (!payload?.sub) throw new UnauthorizedException('Invalid session');
    return String(payload.sub);
  }

  @Get('settings')
  settings(@Headers('authorization') auth?: string) {
    return this.cron.getConfig(this.userId(auth));
  }

  @Post('settings')
  save(@Headers('authorization') auth: string | undefined, @Body() body?: Record<string, unknown>) {
    return this.cron.saveConfig(this.userId(auth), {
      enabled: body?.enabled as boolean | undefined,
      schedule: body?.schedule as string | undefined,
      timezone: body?.timezone as string | undefined,
      syncStartDate: body?.syncStartDate as string | null | undefined,
      syncEndDate: body?.syncEndDate as string | null | undefined,
      batchSize: body?.batchSize as number | undefined,
      priceSyncEnabled: body?.priceSyncEnabled as boolean | undefined,
      telegramCredentialId: body?.telegramCredentialId as string | null | undefined,
    });
  }

  @Post('trigger')
  trigger(@Headers('authorization') auth?: string) {
    return this.cron.trigger(this.userId(auth));
  }

  @Get('runs')
  runs(@Headers('authorization') auth?: string, @Query('limit') limit?: string) {
    return this.cron.runs(this.userId(auth), Number(limit ?? 20));
  }
}
