import { SupabaseClient } from '@supabase/supabase-js';

export interface TceAccountRepository {
  resolveForUser(userId: string): Promise<string>;
}

export class SupabaseAccountAdapter implements TceAccountRepository {
  constructor(private readonly db: SupabaseClient) {}

  async resolveForUser(userId: string) {
    const { data, error } = await this.db
      .from('tce_accounts')
      .select('id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) throw new Error(`TCE account not found for user: ${userId}`);
    return String(data.id);
  }
}
