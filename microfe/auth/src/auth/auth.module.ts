import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { PasskeyRepository } from './passkey.repository';
import { PasskeyService } from './passkey.service';
import { PasswordService } from './password.service';
import { PostgresService } from './postgres.service';

@Module({
  controllers: [AuthController],
  providers: [PostgresService, AuthRepository, AuthService, PasswordService, MfaService, PasskeyRepository, PasskeyService],
  exports: [AuthRepository, AuthService, PasswordService, MfaService, PasskeyService],
})
export class AuthModule {}
