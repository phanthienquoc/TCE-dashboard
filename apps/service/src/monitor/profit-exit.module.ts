import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformCredentialsModule } from '../platform/platform-credentials.module';
import { TceSsiExecutionAdapter } from '../platform/tce-ssi-execution.adapter';
import { TceExecutionOrchestrator } from '@tce/tce';
import type { TceExecutionIdempotencyStore } from '@tce/contracts';
import { ProfitExitCronService } from './profit-exit-cron.service';
import { ProfitExitExecutionService } from './profit-exit-execution.service';

@Module({
  imports: [DbModule, PlatformCredentialsModule],
  providers: [
    TceSsiExecutionAdapter,
    {
      provide: TceExecutionOrchestrator,
      inject: [TceSsiExecutionAdapter, 'TCE_EXECUTION_IDEMPOTENCY_STORE'],
      useFactory: (
        execution: TceSsiExecutionAdapter,
        idempotencyStore: TceExecutionIdempotencyStore
      ) =>
        new TceExecutionOrchestrator(
          execution,
          process.env['TCE_DURABLE_EXECUTION_IDEMPOTENCY_ENABLED'] === 'true'
            ? { idempotencyStore }
            : {}
        ),
    },
    ProfitExitCronService,
    ProfitExitExecutionService,
  ],
  exports: [ProfitExitCronService, ProfitExitExecutionService],
})
export class ProfitExitModule {}
