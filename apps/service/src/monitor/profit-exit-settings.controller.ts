import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { SupabaseClientService } from '../db/supabase.client';

@Controller('profit-exit-settings')
export class ProfitExitSettingsController {
  constructor(private readonly supabase: SupabaseClientService, private readonly jwt: JwtService) {}
  @Get()
  async get(@Headers('authorization') auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    const userId = this.jwt.verify(auth.slice(7)).sub;
    const { data: account, error: accountError } = await this.supabase.db.from('tce_accounts').select('id').eq('user_id', userId).maybeSingle();
    if (accountError) throw accountError;
    if (!account?.id) throw new UnauthorizedException('TCE account is not configured');
    const { data, error } = await this.supabase.db.from('tce_strategy_config').select('auto_sell_enabled,auto_sell_profit_target_pct,auto_sell_interval_minutes,auto_sell_last_run_at').eq('account_id', account.id).maybeSingle();
    if (error) throw error;
    return { enabled: data?.auto_sell_enabled ?? false, profitTargetPct: Number(data?.auto_sell_profit_target_pct ?? 10), intervalMinutes: Number(data?.auto_sell_interval_minutes ?? 60), lastRunAt: data?.auto_sell_last_run_at ?? null };
  }
  @Post()
  async set(@Headers('authorization') auth?: string, @Body() body?: { enabled?: boolean; profitTargetPct?: number; intervalMinutes?: number }) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    const userId = this.jwt.verify(auth.slice(7)).sub;
    const { data: account, error: accountError } = await this.supabase.db.from('tce_accounts').select('id').eq('user_id', userId).maybeSingle();
    if (accountError) throw accountError;
    if (!account?.id) throw new UnauthorizedException('TCE account is not configured');
    const target = Number(body?.profitTargetPct ?? 10);
    const interval = Number(body?.intervalMinutes ?? 60);
    if (!Number.isFinite(target) || !Number.isFinite(interval)) throw new Error('Configuration values must be finite numbers');
    const { data, error } = await this.supabase.db.from('tce_strategy_config').upsert({ account_id: account.id, auto_sell_enabled: body?.enabled === true, auto_sell_profit_target_pct: Math.min(1000, Math.max(0, target)), auto_sell_interval_minutes: Math.min(1440, Math.max(1, Math.trunc(interval))), updated_at: new Date().toISOString() }, { onConflict: 'account_id' }).select('auto_sell_enabled,auto_sell_profit_target_pct,auto_sell_interval_minutes,auto_sell_last_run_at').single();
    if (error) throw error;
    return { enabled: Boolean(data.auto_sell_enabled), profitTargetPct: Number(data.auto_sell_profit_target_pct), intervalMinutes: Number(data.auto_sell_interval_minutes), lastRunAt: data.auto_sell_last_run_at ?? null };
  }
}
