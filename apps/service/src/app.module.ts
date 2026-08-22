import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';

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
  controllers: [HealthController],
})
export class AppModule {}
