import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { SystemUpdatesService, type PushSubscriptionPayload } from './system-updates.service';

@Controller('tce/system-updates')
export class SystemUpdatesController {
  constructor(
    private readonly updates: SystemUpdatesService,
    private readonly jwt: JwtService
  ) {}

  private userId(auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    return this.jwt.verify(auth.slice(7)).sub;
  }

  @Get('config')
  config() {
    return this.updates.getConfig();
  }

  @Get('latest')
  latest(@Headers('authorization') auth?: string) {
    return this.updates.getLatest(this.userId(auth));
  }

  @Post('subscription')
  subscribe(
    @Headers('authorization') auth: string | undefined,
    @Body() body: PushSubscriptionPayload
  ) {
    return this.updates.saveSubscription(this.userId(auth), body);
  }

  @Delete('subscription')
  unsubscribe(
    @Headers('authorization') auth: string | undefined,
    @Body() body: { endpoint?: string }
  ) {
    return this.updates.removeSubscription(this.userId(auth), body?.endpoint);
  }
}
