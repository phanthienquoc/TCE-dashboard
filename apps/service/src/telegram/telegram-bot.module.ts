import { Module } from '@nestjs/common';
import { CONTRACT_TOKENS } from '@tce/contracts';
import { SupabaseCredentialAdapter } from '@tce/db';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { SupabaseClientService } from '../db/supabase.client';
import { TceEngineModule } from '../monitor/tce-engine.module';
import { TelegramBotController } from './telegram-bot.controller';
import { TelegramBotService } from './telegram-bot.service';

@Module({
  imports: [DbModule, AuthModule, TceEngineModule],
  controllers: [TelegramBotController],
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
    TelegramBotService,
  ],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
