import { Global, Module } from '@nestjs/common';
import { SupabaseClientService } from './supabase.client';
import { MongoDbClient } from './mongodb.client';

@Global()
@Module({
  providers: [SupabaseClientService, MongoDbClient],
  exports: [SupabaseClientService, MongoDbClient],
})
export class DbModule {}
