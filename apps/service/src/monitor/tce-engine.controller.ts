import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { TceEngineService } from './tce-engine.service';
import { BinanceEngineService } from './binance-engine.service';
import { parseTradingSignal } from './trading-signal.parser';

@Controller('tce/engine')
export class TceEngineController {
  constructor(
    private readonly engine: TceEngineService,
    private readonly binance: BinanceEngineService,
    private readonly jwt: JwtService
  ) {}

  private userId(auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    return this.jwt.verify(auth.slice(7)).sub;
  }

  private binanceEnvironment(value?: string): 'production' | 'testnet' {
    const environment = value ?? 'production';
    if (environment !== 'production' && environment !== 'testnet')
      throw new UnauthorizedException(`Unsupported Binance environment: ${environment}`);
    return environment;
  }

  @Get('binance/config')
  getBinanceConfig(@Headers('authorization') auth?: string) {
    return this.binance.getConfig(this.userId(auth));
  }

  @Patch('binance/config')
  setBinanceConfig(
    @Headers('authorization') auth: string | undefined,
    @Body()
    body: {
      enabled?: boolean;
      quantity?: number;
      positionSide?: 'BOTH' | 'LONG' | 'SHORT';
      xauEnabled?: boolean;
      xauSymbol?: string;
      autoProtection?: boolean;
      tpPct?: number;
      slPct?: number;
    }
  ) {
    return this.binance.setConfig(this.userId(auth), body ?? {});
  }

  @Get('binance/positions')
  getBinancePositions(
    @Headers('authorization') auth?: string,
    @Headers('x-environment') environment = 'production'
  ) {
    return this.binance.getLivePosition(this.userId(auth), this.binanceEnvironment(environment));
  }

  @Get('binance/orders')
  getBinanceOrders(
    @Headers('authorization') auth?: string,
    @Headers('x-environment') environment = 'production'
  ) {
    return this.binance.openOrdersForSymbol(
      this.userId(auth),
      this.binanceEnvironment(environment),
      'XAUUSDT'
    );
  }

  @Post('run')
  async run(@Req() req: any) {
    const accountId = String(
      req.user?.id ?? req.user?.accountId ?? req.headers['x-account-id'] ?? ''
    );
    const environment = String(req.headers['x-environment'] ?? 'production');
    if (!accountId) throw new Error('Authenticated account is required');
    return this.engine.run(accountId, environment, false);
  }

  @Post('execute')
  async execute(@Req() req: any) {
    const accountId = String(
      req.user?.id ?? req.user?.accountId ?? req.headers['x-account-id'] ?? ''
    );
    const environment = String(req.headers['x-environment'] ?? 'production');
    if (!accountId) throw new Error('Authenticated account is required');
    return this.engine.run(accountId, environment, true);
  }

  @Post('signal/parse')
  parseSignal(@Req() req: any) {
    const text =
      typeof req.body?.text === 'string' ? req.body.text : String(req.body?.signal ?? '');
    return { ok: true, data: parseTradingSignal(text) };
  }

  @Post('binance/scan')
  async scanBinance() {
    await this.binance.scan();
    return { ok: true };
  }
}
