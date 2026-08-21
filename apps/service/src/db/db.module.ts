import { Global, Module } from '@nestjs/common';
import { SupabaseClientService } from './supabase.client';

@Global()
@Module({ providers: [SupabaseClientService], exports: [SupabaseClientService] })
export class DbModule {}
