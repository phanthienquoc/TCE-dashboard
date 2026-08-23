import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService, private readonly jwt: JwtService) {}

  private userId(auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    return this.jwt.verify(auth.slice(7)).sub;
  }

  @Get()
  get(@Headers('authorization') auth?: string) {
    return this.dashboard.get(this.userId(auth));
  }
}
