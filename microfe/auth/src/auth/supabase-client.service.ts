import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseClientService {
  private client: SupabaseClient | null = null;

  get configured(): boolean {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  get db(): SupabaseClient {
    if (!this.configured) throw new Error('SUPABASE_NOT_CONFIGURED');
    if (!this.client) {
      this.client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
      );
    }
    return this.client;
  }
}
