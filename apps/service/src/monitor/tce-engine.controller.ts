import { Controller, Post, Req } from '@nestjs/common';
import { TceEngineService } from './tce-engine.service';

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
}
