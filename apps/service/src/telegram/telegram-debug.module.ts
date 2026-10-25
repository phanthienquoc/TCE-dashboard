import { Global, Module } from '@nestjs/common';
import { CONTRACT_TOKENS } from '@tce/contracts';
import { SupabaseCredentialAdapter } from '@tce/db';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { SupabaseClientService } from '../db/supabase.client';
import { TelegramDebugService } from './telegram-debug.service';

@Global()
@Module({
  imports: [DbModule, AuthModule],
  providers: [
    {
      provide: CONTRACT_TOKENS.credentials,
      inject: [SupabaseClientService],
      useFactory: (db: SupabaseClientService) => {
        const key = process.env.TCE_CREDENTIAL_ENCRYPTION_KEY;
        if (!key) throw new Error('TCE_CREDENTIAL_ENCRYPTION_KEY is required');
        return new SupabaseCredentialAdapter(db.db, key);
      },
    },
    TelegramDebugService,
  ],
  exports: [TelegramDebugService],
})
export class TelegramDebugModule {}
