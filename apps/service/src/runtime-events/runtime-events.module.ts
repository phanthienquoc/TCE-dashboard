import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { RuntimeEventsController } from './runtime-events.controller';
import { RuntimeEventsQueryService } from './runtime-events.query.service';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [RuntimeEventsController],
  providers: [RuntimeEventsQueryService],
  exports: [RuntimeEventsQueryService],
})
export class RuntimeEventsModule {}
