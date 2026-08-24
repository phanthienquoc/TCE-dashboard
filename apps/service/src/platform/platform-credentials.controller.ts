import { Body, Controller, Delete, Get, Headers, Param, Post, UnauthorizedException, Inject } from '@nestjs/common';
import { CONTRACT_TOKENS, PlatformCredentialPort, SsiAuthInput } from '@tce/contracts';
import { JwtService } from '../auth/jwt.service';
import { SsiApplicationService } from './ssi.application.service';

@Controller('platform/credentials')
export class PlatformCredentialsController {
  constructor(@Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort, private readonly ssi: SsiApplicationService, private readonly jwt: JwtService) {}
  private userId(auth?: string) { if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required'); return this.jwt.verify(auth.slice(7)).sub; }
  @Get() list(@Headers('authorization') auth?: string) { return this.credentials.list(this.userId(auth)); }
  @Post(':provider') save(@Headers('authorization') auth: string | undefined, @Param('provider') provider: 'ssi' | 'binance' | 'fastapi', @Body() body: { environment?: string; credentials: Record<string, unknown> }) { if (!body?.credentials || typeof body.credentials !== 'object') throw new UnauthorizedException('Credentials are required'); return this.credentials.save(this.userId(auth), provider, body.environment ?? 'production', body.credentials); }
  @Post(':provider/request-otp') requestOtp(@Headers('authorization') auth: string | undefined, @Param('provider') provider: string, @Body() body?: { environment?: string }) { if (provider !== 'ssi') throw new UnauthorizedException('OTP flow is only available for SSI'); return this.ssi.requestOtp(this.userId(auth), body?.environment ?? 'production'); }
  @Post(':provider/test') test(@Headers('authorization') auth: string | undefined, @Param('provider') provider: string, @Body() body?: { environment?: string; otp?: string; transactionId?: string }) { if (provider !== 'ssi') throw new UnauthorizedException('Connection test is not implemented for this provider yet'); const input: SsiAuthInput = { otp: body?.otp, transactionId: body?.transactionId }; return this.ssi.test(this.userId(auth), body?.environment ?? 'production', input); }
  @Post(':provider/sync') sync(@Headers('authorization') auth: string | undefined, @Param('provider') provider: string, @Body() body?: { environment?: string; otp?: string; transactionId?: string }) { if (provider !== 'ssi') throw new UnauthorizedException('Portfolio sync is only available for SSI'); const input: SsiAuthInput = { otp: body?.otp, transactionId: body?.transactionId }; return this.ssi.sync(this.userId(auth), body?.environment ?? 'production', input); }
  @Delete(':provider') remove(@Headers('authorization') auth: string | undefined, @Param('provider') provider: 'ssi' | 'binance' | 'fastapi', @Body() body?: { environment?: string }) { return this.credentials.remove(this.userId(auth), provider, body?.environment ?? 'production'); }
}
