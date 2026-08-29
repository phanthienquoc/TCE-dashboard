import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { MfaController } from './mfa.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { PasskeyRepository } from './passkey.repository';
import { PasskeyService } from './passkey.service';
import { JwtService } from './jwt.service';
import { MfaService } from './mfa.service';
import { MfaCryptoService } from './mfa-crypto.service';
import { PasswordService } from './password.service';
import { RefreshService } from './refresh.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [AuthController, MfaController],
  providers: [
    AuthService,
    AuthRepository,
    PasskeyRepository,
    PasskeyService,
    JwtService,
    MfaService,
    MfaCryptoService,
    PasswordService,
    RefreshService,
  ],
  exports: [
    AuthService,
    AuthRepository,
    JwtService,
    MfaService,
    MfaCryptoService,
    PasswordService,
    RefreshService,
    PasskeyService,
  ],
})
export class AuthModule {}
