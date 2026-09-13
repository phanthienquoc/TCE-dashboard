import { Module } from '@nestjs/common';
import { ProfitExitModule } from './monitor/profit-exit.module';
import { ProfitExitSettingsModule } from './monitor/profit-exit-settings.module';

@Module({ imports: [ProfitExitModule, ProfitExitSettingsModule] })
export class ScheduledTasksModule {}
