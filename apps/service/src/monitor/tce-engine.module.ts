import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformCredentialsModule } from '../platform/platform-credentials.module';
import { TceEngineController } from './tce-engine.controller';
import { TceEngineService } from './tce-engine.service';

@Module({
  imports: [DbModule, PlatformCredentialsModule],
  controllers: [TceEngineController],
  providers: [TceEngineService],
  exports: [TceEngineService],
})
export class TceEngineModule {}
