import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { ProfitExitModule } from './profit-exit.module';
import { ProfitExitSettingsController } from './profit-exit-settings.controller';

@Module({
  imports: [DbModule, AuthModule, ProfitExitModule],
  controllers: [ProfitExitSettingsController],
})
export class ProfitExitSettingsModule {}
