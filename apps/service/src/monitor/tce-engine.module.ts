import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformCredentialsModule } from '../platform/platform-credentials.module';
import { TceEngineController } from './tce-engine.controller';
import { TceEngineService } from './tce-engine.service';
import { TceSignalService } from './tce-signal.service';
import { BinanceEngineService } from './binance-engine.service';
import { BinancePositionWatcherService } from './binance-position-watcher.service';

@Module({
  imports: [DbModule, AuthModule, PlatformCredentialsModule],
  controllers: [TceEngineController],
  providers: [
    TceEngineService,
    TceSignalService,
    BinanceEngineService,
    BinancePositionWatcherService,
  ],
  exports: [
    TceEngineService,
    TceSignalService,
    BinanceEngineService,
    BinancePositionWatcherService,
  ],
})
export class TceEngineModule {}
