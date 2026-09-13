import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { ProfitExitSettingsController } from './profit-exit-settings.controller';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [ProfitExitSettingsController],
})
export class ProfitExitSettingsModule {}
