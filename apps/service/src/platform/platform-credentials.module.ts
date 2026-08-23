import { Module } from '@nestjs/common';
import { CONTRACT_TOKENS } from '@tce/contracts';
import { SupabaseCredentialAdapter, SupabaseOrderAdapter, SupabasePositionAdapter } from '@tce/db';
import { SsiApplicationService } from './ssi.application.service';
import { PlatformCredentialsController } from './platform-credentials.controller';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { SupabaseClientService } from '../db/supabase.client';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [PlatformCredentialsController],
  providers: [
    {
      provide: CONTRACT_TOKENS.credentials,
      inject: [SupabaseClientService],
      useFactory: (db: SupabaseClientService) => {
        const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
        if (!key) throw new Error('CREDENTIAL_ENCRYPTION_KEY is required');
        return new SupabaseCredentialAdapter(db.db, key);
      },
    },
    {
      provide: CONTRACT_TOKENS.positionRepository,
      inject: [SupabaseClientService],
      useFactory: (db: SupabaseClientService) => new SupabasePositionAdapter(db.db),
    },
    {
      provide: CONTRACT_TOKENS.orderRepository,
      inject: [SupabaseClientService],
      useFactory: (db: SupabaseClientService) => new SupabaseOrderAdapter(db.db),
    },
    SsiApplicationService,
  ],
  exports: [CONTRACT_TOKENS.credentials, CONTRACT_TOKENS.positionRepository, CONTRACT_TOKENS.orderRepository, SsiApplicationService],
})
export class PlatformCredentialsModule {}
