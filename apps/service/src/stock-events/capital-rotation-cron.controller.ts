import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { CapitalRotationCronService } from './capital-rotation-cron.service';

@Controller('capital-rotation-cron')
export class CapitalRotationCronController {
  constructor(
    private readonly cron: CapitalRotationCronService,
    private readonly jwt: JwtService
  ) {}

  private userId(auth?: string) {
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required');
    }
    const payload = this.jwt.verify(auth.slice(7));
    if (!payload?.sub) throw new UnauthorizedException('Invalid session');
    return String(payload.sub);
  }

  @Get('status')
  status(@Headers('authorization') auth?: string) {
    return this.cron.status(this.userId(auth));
  }

  @Get('runs')
  runs(@Headers('authorization') auth?: string, @Headers('x-limit') limit?: string) {
    return this.cron.runs(this.userId(auth), Number(limit ?? 20));
  }
}
