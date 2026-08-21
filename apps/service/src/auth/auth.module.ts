import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';

@Module({ controllers: [AuthController], providers: [AuthService, MfaService, PasswordService], exports: [AuthService, MfaService, PasswordService] })
export class AuthModule {}
