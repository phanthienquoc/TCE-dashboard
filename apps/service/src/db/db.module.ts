import { Global, Module } from '@nestjs/common';
import { SupabaseClientService } from './supabase.client';
import { MongoDbClient } from './mongodb.client';
import { PostgresService } from './postgres.client';

@Global()
@Module({
  providers: [SupabaseClientService, MongoDbClient, PostgresService],
  exports: [SupabaseClientService, MongoDbClient, PostgresService],
})
export class DbModule {}
