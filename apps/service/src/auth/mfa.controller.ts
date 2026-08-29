import { Body, Controller, Post } from '@nestjs/common';
import { MfaService } from './mfa.service';

@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}
  @Post('setup') setup() {
    const secret = this.mfa.generateSecret();
    return { secret };
  }
  @Post('verify') verify(@Body() body: { secret: string; code: string }) {
    return { valid: this.mfa.verifyTotp(body.secret, body.code) };
  }
  @Post('recovery-code') recoveryCode() {
    return { code: this.mfa.generateRecoveryCode() };
  }
}
