import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StockEventsController } from './stock-events.controller';
import { StockEventsService } from './stock-events.service';

@Module({
  imports: [AuthModule],
  controllers: [StockEventsController],
  providers: [StockEventsService],
  exports: [StockEventsService],
})
export class StockEventsModule {}
