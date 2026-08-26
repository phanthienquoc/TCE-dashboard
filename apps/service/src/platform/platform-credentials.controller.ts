import { Body, Controller, Delete, Get, Headers, Param, Post, UnauthorizedException, Inject } from '@nestjs/common';
import { CONTRACT_TOKENS, FuturesEntryOrderInput, FuturesTpSlInput, PlatformCredentialPort, SsiAuthInput } from '@tce/contracts';
import { JwtService } from '../auth/jwt.service';
import { SsiApplicationService } from './ssi.application.service';
import { BinanceFuturesService } from './binance-futures.service';

@Controller('platform/credentials')
export class PlatformCredentialsController {
  constructor(
    @Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort,
    private readonly ssi: SsiApplicationService,
    private readonly binance: BinanceFuturesService,
    private readonly jwt: JwtService,
  ) {}

  private userId(auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    return this.jwt.verify(auth.slice(7)).sub;
  }

  private binanceEnvironment(value?: string): 'production' | 'testnet' {
    const environment = value ?? 'production';
    if (environment !== 'production' && environment !== 'testnet') {
      throw new UnauthorizedException(`Unsupported Binance environment: ${environment}`);
    }
    return environment;
  }

  @Get()
  list(@Headers('authorization') auth?: string) { return this.credentials.list(this.userId(auth)); }

  @Post(':provider')
  save(@Headers('authorization') auth: string | undefined, @Param('provider') provider: 'ssi' | 'binance' | 'fastapi', @Body() body: { environment?: string; credentials: Record<string, unknown> }) {
    if (!body?.credentials || typeof body.credentials !== 'object') throw new UnauthorizedException('Credentials are required');
    const environment = provider === 'binance' ? this.binanceEnvironment(body.environment) : body.environment ?? 'production';
    const credentials = provider === 'binance'
      ? { apiKey: body.credentials.apiKey, apiSecret: body.credentials.apiSecret }
      : body.credentials;
    if (provider === 'binance' && (typeof credentials.apiKey !== 'string' || typeof credentials.apiSecret !== 'string' || !credentials.apiKey || !credentials.apiSecret)) {
      throw new UnauthorizedException('Binance API Key and API Secret are required');
    }
    return this.credentials.save(this.userId(auth), provider, environment, credentials);
  }

  @Post('binance/test')
  testBinance(@Headers('authorization') auth: string | undefined, @Body() body?: { environment?: string }) {
    return this.binance.testConnection(this.userId(auth), this.binanceEnvironment(body?.environment));
  }

  @Post('binance/order')
  orderBinance(@Headers('authorization') auth: string | undefined, @Body() body: FuturesEntryOrderInput & { environment?: string }) {
    const { environment, ...input } = body;
    return this.binance.entry(this.userId(auth), input, this.binanceEnvironment(environment));
  }

  @Post('binance/tp')
  takeProfitBinance(@Headers('authorization') auth: string | undefined, @Body() body: FuturesTpSlInput & { environment?: string }) {
    const { environment, ...input } = body;
    return this.binance.takeProfit(this.userId(auth), input, this.binanceEnvironment(environment));
  }

  @Post('binance/sl')
  stopLossBinance(@Headers('authorization') auth: string | undefined, @Body() body: FuturesTpSlInput & { environment?: string }) {
    const { environment, ...input } = body;
    return this.binance.stopLoss(this.userId(auth), input, this.binanceEnvironment(environment));
  }

  @Post(':provider/request-otp')
  requestOtp(@Headers('authorization') auth: string | undefined, @Param('provider') provider: string, @Body() body?: { environment?: string; credentials?: Record<string, unknown> }) {
    if (provider !== 'ssi') throw new UnauthorizedException('OTP flow is only available for SSI');
    return this.ssi.requestOtp(this.userId(auth), body?.environment ?? 'production', body?.credentials);
  }

  @Post(':provider/test')
  test(@Headers('authorization') auth: string | undefined, @Param('provider') provider: string, @Body() body?: { environment?: string; otp?: string; transactionId?: string; credentials?: Record<string, unknown> }) {
    if (provider !== 'ssi') throw new UnauthorizedException('Connection test is not implemented for this provider yet');
    const input: SsiAuthInput = { otp: body?.otp, transactionId: body?.transactionId };
    return this.ssi.test(this.userId(auth), body?.environment ?? 'production', input, body?.credentials);
  }

  @Post(':provider/save-tested')
  saveTested(@Headers('authorization') auth: string | undefined, @Param('provider') provider: string, @Body() body?: { environment?: string; otp?: string; transactionId?: string; credentials?: Record<string, unknown> }) {
    if (provider !== 'ssi') throw new UnauthorizedException('Save-tested flow is not implemented for this provider yet');
    if (!body?.credentials || typeof body.credentials !== 'object') throw new UnauthorizedException('Credentials are required');
    const input: SsiAuthInput = { otp: body?.otp, transactionId: body?.transactionId };
    return this.ssi.saveTested(this.userId(auth), body?.environment ?? 'production', body.credentials, input);
  }

  @Post(':provider/current')
  current(@Headers('authorization') auth: string | undefined, @Param('provider') provider: string, @Body() body?: { environment?: string; otp?: string; transactionId?: string }) {
    if (provider !== 'ssi') throw new UnauthorizedException('Current account info is only available for SSI');
    return this.ssi.current(this.userId(auth), body?.environment ?? 'production', { otp: body?.otp, transactionId: body?.transactionId });
  }

  @Post(':provider/sync')
  sync(@Headers('authorization') auth: string | undefined, @Param('provider') provider: string, @Body() body?: { environment?: string; otp?: string; transactionId?: string }) {
    if (provider !== 'ssi') throw new UnauthorizedException('Portfolio sync is only available for SSI');
    return this.ssi.sync(this.userId(auth), body?.environment ?? 'production', { otp: body?.otp, transactionId: body?.transactionId });
  }

  @Delete(':provider')
  remove(@Headers('authorization') auth: string | undefined, @Param('provider') provider: 'ssi' | 'binance' | 'fastapi', @Body() body?: { environment?: string }) {
    const environment = provider === 'binance' ? this.binanceEnvironment(body?.environment) : body?.environment ?? 'production';
    return this.credentials.remove(this.userId(auth), provider, environment);
  }
}
