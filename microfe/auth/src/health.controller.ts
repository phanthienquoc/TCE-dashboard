import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AuthRepository } from './auth/auth.repository';

@Controller()
export class HealthController {
  constructor(private readonly repo: AuthRepository) {}

  @Get('health/live')
  live() {
    return { ok: true, service: 'microfe-auth' };
  }

  @Get('health')
  health() {
    return { ok: true, service: 'microfe-auth' };
  }

  @Get('health/ready')
  async ready() {
    try {
      await this.repo.checkDatabase();
      return { ok: true, service: 'microfe-auth', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException({ ok: false, service: 'microfe-auth', database: 'unavailable' });
    }
  }
}
