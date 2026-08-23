import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { CredentialsCryptoService } from './credentials-crypto.service';
import { PlatformCredentialsController } from './platform-credentials.controller';
import { PlatformCredentialsService } from './platform-credentials.service';
import { SsiService } from './ssi.service';

@Module({ imports: [DbModule, AuthModule], controllers: [PlatformCredentialsController], providers: [CredentialsCryptoService, PlatformCredentialsService, SsiService], exports: [PlatformCredentialsService, SsiService] })
export class PlatformCredentialsModule {}
