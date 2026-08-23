import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { TceMonitorService } from './tce-monitor.service';

@Controller('monitor')
export class TceMonitorController {
  constructor(private readonly monitor: TceMonitorService) {}

  @Get('run')
  run(@Headers('x-tce-monitor-secret') providedSecret?: string) {
    const expected = process.env.TCE_MONITOR_RUN_SECRET;
    if (!expected) throw new UnauthorizedException('Manual monitor endpoint is disabled');
    if (!providedSecret || !this.safeEqual(providedSecret, expected)) {
      throw new UnauthorizedException('Invalid monitor secret');
    }
    return this.monitor.run();
  }

  private safeEqual(a: string, b: string) {
    const aa = Buffer.from(a);
    const bb = Buffer.from(b);
    return aa.length === bb.length && timingSafeEqual(aa, bb);
  }
}
