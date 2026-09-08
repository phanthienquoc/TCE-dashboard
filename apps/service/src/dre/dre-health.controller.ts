import { Controller, Get } from '@nestjs/common';
import { DreProductionService } from './dre-production.service';

@Controller('dre/health')
export class DreHealthController {
  constructor(private readonly production: DreProductionService) {}
  @Get()
  async health() {
    return this.production.health();
  }
}
