import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { TceMonitorController } from './tce-monitor.controller';
import { TceMonitorService } from './tce-monitor.service';

@Module({
  imports: [DbModule],
  controllers: [TceMonitorController],
  providers: [TceMonitorService],
  exports: [TceMonitorService],
})
export class TceMonitorModule {}
