import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformCredentialsModule } from '../platform/platform-credentials.module';
import { TceEngineController } from './tce-engine.controller';
import { TceEngineService } from './tce-engine.service';
import { TceSignalService } from './tce-signal.service';

@Module({
  imports: [DbModule, PlatformCredentialsModule],
  controllers: [TceEngineController],
  providers: [TceEngineService, TceSignalService],
  exports: [TceEngineService, TceSignalService],
})
export class TceEngineModule {}
