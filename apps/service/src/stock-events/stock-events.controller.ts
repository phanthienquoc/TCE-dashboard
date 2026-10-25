import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { StockEventsService } from './stock-events.service';

@Controller('stock-events')
export class StockEventsController {
  constructor(
    private readonly events: StockEventsService,
    private readonly jwt: JwtService
  ) {}

  @Get()
  get(@Headers('authorization') auth?: string, @Query('limit') limit?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    this.jwt.verify(auth.slice(7));
    return this.events.getUpcoming(Number(limit ?? 100));
  }
}
