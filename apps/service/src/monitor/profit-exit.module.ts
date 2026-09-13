import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformCredentialsModule } from '../platform/platform-credentials.module';
import { TceSsiExecutionAdapter } from '../platform/tce-ssi-execution.adapter';
import { ProfitExitCronService } from './profit-exit-cron.service';

@Module({
  imports:[DbModule,PlatformCredentialsModule],
  providers:[TceSsiExecutionAdapter,ProfitExitCronService],
  exports:[ProfitExitCronService],
})
export class ProfitExitModule {}
