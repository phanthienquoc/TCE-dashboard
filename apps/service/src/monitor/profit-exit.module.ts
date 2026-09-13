import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformCredentialsModule } from '../platform/platform-credentials.module';
import { TceSsiExecutionAdapter } from '../platform/tce-ssi-execution.adapter';
import { ProfitExitCronService } from './profit-exit-cron.service';
import { ProfitExitExecutionService } from './profit-exit-execution.service';

@Module({
  imports: [DbModule, PlatformCredentialsModule],
  providers: [TceSsiExecutionAdapter, ProfitExitCronService, ProfitExitExecutionService],
  exports: [ProfitExitCronService, ProfitExitExecutionService],
})
export class ProfitExitModule {}
