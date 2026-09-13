import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { ProfitExitCronService } from './profit-exit-cron.service';

@Module({ imports: [DbModule], providers: [ProfitExitCronService], exports: [ProfitExitCronService] })
export class ProfitExitModule {}
