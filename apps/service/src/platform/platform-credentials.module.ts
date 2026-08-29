import { Module } from '@nestjs/common';
import { CONTRACT_TOKENS } from '@tce/contracts';
import { SupabaseCredentialAdapter, SupabaseOrderAdapter, SupabasePositionAdapter } from '@tce/db';
import { SsiApplicationService } from './ssi.application.service';
import { SsiAssetSyncService } from './ssi-asset-sync.service';
import { SsiMarketPriceService } from './ssi-market-price.service';
import { BinanceFuturesService } from './binance-futures.service';
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
        const key = process.env.TCE_CREDENTIAL_ENCRYPTION_KEY;
        if (!key) throw new Error('TCE_CREDENTIAL_ENCRYPTION_KEY is required');
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
    SsiAssetSyncService,
    SsiMarketPriceService,
    BinanceFuturesService,
  ],
  exports: [
    CONTRACT_TOKENS.credentials,
    CONTRACT_TOKENS.positionRepository,
    CONTRACT_TOKENS.orderRepository,
    SsiApplicationService,
    SsiAssetSyncService,
    SsiMarketPriceService,
    BinanceFuturesService,
  ],
})
export class PlatformCredentialsModule {}
