import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { PlatformCredentialsModule } from './platform/platform-credentials.module';
import { ProfitExitModule } from './monitor/profit-exit.module';
import { ProfitExitSettingsModule } from './monitor/profit-exit-settings.module';
import { StockEventsModule } from './stock-events/stock-events.module';
import { StockEventsCronController } from './stock-events/stock-events-cron.controller';
import { StockEventsCronService } from './stock-events/stock-events-cron.service';
import { StockEventsSyncService } from './stock-events/stock-events-sync.service';
import { VietstockEventsCrawler } from './stock-events/vietstock-events.crawler';
import { DividendOhlcvService } from './stock-events/dividend-ohlcv.service';
import { DividendOhlcvCronService } from './stock-events/dividend-ohlcv-cron.service';
import { TelegramBotModule } from './telegram/telegram-bot.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    DbModule,
    PlatformCredentialsModule,
    TelegramBotModule,
    StockEventsModule,
    ProfitExitModule,
    ProfitExitSettingsModule,
  ],
  controllers: [StockEventsCronController],
  providers: [
    StockEventsCronService,
    StockEventsSyncService,
    VietstockEventsCrawler,
    DividendOhlcvService,
    DividendOhlcvCronService,
  ],
  exports: [StockEventsCronService, DividendOhlcvService],
})
export class ScheduledTasksModule {}
