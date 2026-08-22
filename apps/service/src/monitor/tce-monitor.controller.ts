import { Controller, Get } from '@nestjs/common';
import { TceMonitorService } from './tce-monitor.service';

@Controller('monitor')
export class TceMonitorController {
  constructor(private readonly monitor: TceMonitorService) {}

  @Get('run')
  run() {
    return this.monitor.run();
  }
}
