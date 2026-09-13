import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformCredentialsModule } from '../platform/platform-credentials.module';
import { TceEngineController } from './tce-engine.controller';
import { TceEngineService } from './tce-engine.service';
import { TceSignalService } from './tce-signal.service';
import { BinanceEngineService } from './binance-engine.service';
import { BinancePositionWatcherService } from './binance-position-watcher.service';
import { GeminiSignalParserService } from './gemini-signal-parser.service';
import { ScheduledTasksModule } from '../scheduled-tasks.module';

@Module({
  imports: [DbModule, AuthModule, PlatformCredentialsModule, ScheduledTasksModule],
  controllers: [TceEngineController],
  providers: [
    TceEngineService,
    TceSignalService,
    BinanceEngineService,
    BinancePositionWatcherService,
    GeminiSignalParserService,
  ],
  exports: [
    TceEngineService,
    TceSignalService,
    BinanceEngineService,
    BinancePositionWatcherService,
    GeminiSignalParserService,
  ],
})
export class TceEngineModule {}
