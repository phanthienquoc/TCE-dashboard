import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { SupabaseClientService } from '../db/supabase.client';

@Controller('dashboard')
export class DashboardPriceHistoryController {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly jwt: JwtService
  ) {}

  @Get('price-history')
  async getPriceHistory(
    @Headers('authorization') auth: string | undefined,
    @Query('symbol') symbol?: string,
    @Query('days') days?: string
  ) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');

    const userId = this.jwt.verify(auth.slice(7)).sub;
    const normalizedSymbol = String(symbol ?? '').trim().toUpperCase();
    if (!normalizedSymbol) throw new UnauthorizedException('Stock symbol is required');

    const requestedDays = Number(days ?? 365);
    const rangeDays = Number.isFinite(requestedDays)
      ? Math.min(365, Math.max(1, Math.trunc(requestedDays)))
      : 365;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (rangeDays - 1));

    const { data, error } = await this.supabase.db
      .from('tce_market_prices')
      .select('trading_date,price,close_price')
      .eq('user_id', userId)
      .eq('symbol', normalizedSymbol)
      .gte('trading_date', from.toISOString().slice(0, 10))
      .order('trading_date', { ascending: true })
      .limit(rangeDays);

    if (error) throw error;

    return {
      ok: true as const,
      data: (data ?? [])
        .map(row => ({
          date: String(row.trading_date),
          price: Number(row.close_price ?? row.price),
        }))
        .filter(row => Number.isFinite(row.price) && row.price > 0),
    };
  }
}
