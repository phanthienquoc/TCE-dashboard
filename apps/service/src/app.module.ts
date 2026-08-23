import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { PlatformCredentialsModule } from './platform/platform-credentials.module';

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
  imports: [DbModule, AuthModule, PlatformCredentialsModule],
  controllers: [HealthController],
})
export class AppModule {}
