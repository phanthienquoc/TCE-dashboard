import { Controller, Get, Module } from '@nestjs/common';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { ok: true, service: 'tce-service', timestamp: new Date().toISOString() };
  }
}

@Module({ controllers: [HealthController] })
export class AppModule {}
