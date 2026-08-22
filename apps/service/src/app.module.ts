import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { TceMonitorController } from './monitor/tce-monitor.controller';
import { TceMonitorService } from './monitor/tce-monitor.service';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'tce-service',
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [DbModule, AuthModule],
  controllers: [HealthController, TceMonitorController],
  providers: [TceMonitorService],
})
export class AppModule {}
