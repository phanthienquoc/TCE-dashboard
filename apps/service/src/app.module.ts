import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PlatformCredentialsModule } from './platform/platform-credentials.module';
import { PlatformConfigModule } from './platform/platform-config.module';
import { TceEngineModule } from './monitor/tce-engine.module';
import { TelegramBotModule } from './telegram/telegram-bot.module';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { ok: true, service: 'tce-service', timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [DbModule, AuthModule, DashboardModule, PlatformCredentialsModule, PlatformConfigModule, TceEngineModule, TelegramBotModule],
  controllers: [HealthController],
})
export class AppModule {}
