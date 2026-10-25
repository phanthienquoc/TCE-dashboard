import { Injectable } from '@nestjs/common';
import type { DashboardSourceName, DashboardSourceResult } from '@tce/dashboard-data';
import { SupabaseClientService } from '../db/supabase.client';

@Injectable()
export class DashboardSourcesService {
  constructor(private readonly db: SupabaseClientService) {}

  async status(userId: string): Promise<DashboardSourceResult[]> {
    const [fastapi, ssi] = await Promise.all([
      this.db.db
        .from('platform_configs')
        .select('provider,config,updated_at')
        .eq('user_id', userId)
        .eq('provider', 'fastapi')
        .maybeSingle(),
      this.db.db
        .from('platform_credentials')
        .select('provider,environment,updated_at')
        .eq('user_id', userId)
        .eq('provider', 'ssi')
        .maybeSingle(),
    ]);

    return [
      this.result('supabase', true, { role: 'primary', persisted: true }),
      this.result(
        'ssi',
        Boolean(ssi.data) && !ssi.error,
        {
          role: 'account',
          configured: Boolean(ssi.data),
          environment: ssi.data?.environment ?? 'production',
        },
        ssi.error?.message
      ),
      this.result(
        'fastapi',
        Boolean(fastapi.data) && !fastapi.error,
        {
          role: 'market-signal',
          configured: Boolean(fastapi.data),
          config: fastapi.data?.config ?? null,
        },
        fastapi.error?.message
      ),
    ];
  }

  private result(
    source: DashboardSourceName,
    available: boolean,
    data: unknown,
    error?: string | null
  ): DashboardSourceResult {
    return { source, available, data, fetchedAt: new Date().toISOString(), error: error ?? null };
  }
}
