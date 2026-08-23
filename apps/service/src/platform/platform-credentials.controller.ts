import { Body, Controller, Delete, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { PlatformCredentialsService } from './platform-credentials.service';
import { SsiService } from './ssi.service';

@Controller('platform/credentials')
export class PlatformCredentialsController {
  constructor(private readonly service: PlatformCredentialsService, private readonly ssi: SsiService, private readonly jwt: JwtService) {}

  private userId(auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    return this.jwt.verify(auth.slice(7)).sub;
  }

  @Get()
  list(@Headers('authorization') auth?: string) { return this.service.list(this.userId(auth)); }

  @Post(':provider')
  save(@Headers('authorization') auth: string | undefined, @Param('provider') provider: string, @Body() body: { environment?: string; credentials: Record<string, unknown> }) {
    if (!body?.credentials || typeof body.credentials !== 'object') throw new UnauthorizedException('Credentials are required');
    return this.service.save(this.userId(auth), provider, body.environment ?? 'production', body.credentials);
  }

  @Post(':provider/test')
  test(@Headers('authorization') auth: string | undefined, @Param('provider') provider: string, @Body() body?: { environment?: string; otp?: string; transactionId?: string }) {
    const userId = this.userId(auth);
    if (provider === 'ssi') return this.ssi.test(userId, body?.environment ?? 'production', { otp: body?.otp, transactionId: body?.transactionId });
    throw new UnauthorizedException('Connection test is not implemented for this provider yet');
  }

  @Delete(':provider')
  remove(@Headers('authorization') auth: string | undefined, @Param('provider') provider: string, @Body() body?: { environment?: string }) {
    return this.service.remove(this.userId(auth), provider, body?.environment ?? 'production');
  }
}
