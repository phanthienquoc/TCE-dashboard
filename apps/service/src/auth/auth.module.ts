import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { MfaController } from './mfa.controller';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { RefreshService } from './refresh.service';

@Module({ controllers: [AuthController, MfaController], providers: [AuthService, JwtService, MfaService, PasswordService, RefreshService], exports: [AuthService, JwtService, MfaService, PasswordService, RefreshService] })
export class AuthModule {}
