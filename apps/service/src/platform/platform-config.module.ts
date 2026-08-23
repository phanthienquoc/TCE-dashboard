import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformConfigController } from './platform-config.controller';

@Module({ imports: [DbModule, AuthModule], controllers: [PlatformConfigController] })
export class PlatformConfigModule {}
