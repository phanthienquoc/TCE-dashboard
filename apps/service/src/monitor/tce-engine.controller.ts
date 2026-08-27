import { Controller, Post, Req } from '@nestjs/common';
import { TceEngineService } from './tce-engine.service';
import { parseTradingSignal } from './trading-signal.parser';

@Controller('tce/engine')
export class TceEngineController {
  constructor(private readonly engine: TceEngineService) {}

  @Post('run')
  async run(@Req() req: any) {
    const accountId = String(req.user?.id ?? req.user?.accountId ?? req.headers['x-account-id'] ?? '');
    const environment = String(req.headers['x-environment'] ?? 'production');
    if (!accountId) throw new Error('Authenticated account is required');
    return this.engine.run(accountId, environment, false);
  }

  @Post('execute')
  async execute(@Req() req: any) {
    const accountId = String(req.user?.id ?? req.user?.accountId ?? req.headers['x-account-id'] ?? '');
    const environment = String(req.headers['x-environment'] ?? 'production');
    if (!accountId) throw new Error('Authenticated account is required');
    return this.engine.run(accountId, environment, true);
  }

  @Post('signal/parse')
  parseSignal(@Req() req: any) {
    const text = typeof req.body?.text === 'string' ? req.body.text : String(req.body?.signal ?? '');
    return { ok: true, data: parseTradingSignal(text) };
  }
}
