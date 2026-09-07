import { Module } from '@nestjs/common';
import { StockEventsController } from './stock-events.controller';
import { StockEventsService } from './stock-events.service';

@Module({
  controllers: [StockEventsController],
  providers: [StockEventsService],
  exports: [StockEventsService],
})
export class StockEventsModule {}
