import { Global, Module } from '@nestjs/common';
import { CONTRACT_TOKENS } from '@tce/contracts';
import { SupabaseRuntimeEventPublisher } from '@tce/db';
import { SupabaseClientService } from './supabase.client';
import { MongoDbClient } from './mongodb.client';
import { PostgresService } from './postgres.client';

@Global()
@Module({
  providers: [
    SupabaseClientService,
    MongoDbClient,
    PostgresService,
    {
      provide: CONTRACT_TOKENS.eventPublisher,
      inject: [SupabaseClientService],
      useFactory: (db: SupabaseClientService) => new SupabaseRuntimeEventPublisher(db.db),
    },
  ],
  exports: [
    SupabaseClientService,
    MongoDbClient,
    PostgresService,
    CONTRACT_TOKENS.eventPublisher,
  ],
})
export class DbModule {}
