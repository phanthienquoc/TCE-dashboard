import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { MfaController } from './mfa.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtService } from './jwt.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { RefreshService } from './refresh.service';

@Module({ controllers: [AuthController, MfaController], providers: [AuthService, AuthRepository, JwtService, MfaService, PasswordService, RefreshService], exports: [AuthService, AuthRepository, JwtService, MfaService, PasswordService, RefreshService] })
export class AuthModule {}
