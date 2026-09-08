import { Module } from '@nestjs/common';
import { SystemUpdatesController } from './system-updates.controller';
import { SystemUpdatesService } from './system-updates.service';

@Module({
  controllers: [SystemUpdatesController],
  providers: [SystemUpdatesService],
  exports: [SystemUpdatesService],
})
export class SystemUpdatesModule {}
