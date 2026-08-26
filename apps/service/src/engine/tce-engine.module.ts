import { Module } from '@nestjs/common';
import { TceEngineService } from './tce-engine.service';

@Module({
  providers: [TceEngineService],
  exports: [TceEngineService],
})
export class TceEngineModule {}
