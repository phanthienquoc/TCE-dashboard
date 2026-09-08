import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemUpdatesController } from './system-updates.controller';
import { SystemUpdatesService } from './system-updates.service';

@Module({
  imports: [AuthModule],
  controllers: [SystemUpdatesController],
  providers: [SystemUpdatesService],
  exports: [SystemUpdatesService],
})
export class SystemUpdatesModule {}
