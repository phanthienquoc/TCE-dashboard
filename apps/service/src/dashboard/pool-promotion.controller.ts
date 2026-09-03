import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { SupabaseClientService } from '../db/supabase.client';

@Controller('dashboard/pools')
export class PoolPromotionController {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly jwt: JwtService
  ) {}

  @Post(':poolEntryId/promote')
  async promote(
    @Headers('authorization') auth?: string,
    @Param('poolEntryId') poolEntryId?: string,
    @Body() body?: { entry?: number; quantity?: number }
  ) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    const userId = this.jwt.verify(auth.slice(7)).sub;
    const id = String(poolEntryId ?? '').trim();
    if (!id) throw new BadRequestException('Pool entry id is required');

    const { data: account, error: accountError } = await this.supabase.db
      .from('tce_accounts')
      .select('id,capital_available')
      .eq('user_id', userId)
      .maybeSingle();
    if (accountError) throw new BadRequestException(accountError.message);
    if (!account) throw new BadRequestException('TCE account is not configured');

    const { data: pool, error: poolError } = await this.supabase.db
      .from('tce_pool_entries')
      .select('id,account_id,symbol,rank,score,entry_low,entry_high,target_price,expected_hold_days,rationale,status')
      .eq('id', id)
      .eq('account_id', account.id)
      .single();
    if (poolError || !pool) throw new BadRequestException('Pool entry not found');
    if (String(pool.status ?? '').toUpperCase() === 'PROMOTED') {
      throw new BadRequestException('This pool item is already in Next Positions');
    }

    const { data: existing } = await this.supabase.db
      .from('tce_buy_candidates')
      .select('id,status')
      .eq('account_id', account.id)
      .eq('pool_entry_id', id)
      .in('status', ['queued', 'ready'])
      .maybeSingle();
    if (existing) throw new BadRequestException('This pool item is already in Next Positions');

    const { data: candidates, error: candidateError } = await this.supabase.db
      .from('tce_buy_candidates')
      .select('target_position')
      .eq('account_id', account.id)
      .in('status', ['queued', 'ready']);
    if (candidateError) throw new BadRequestException(candidateError.message);

    const allocated = (candidates ?? []).reduce(
      (sum, row) => sum + Number(row.target_position ?? 0),
      0
    );
    const availableAmount = Math.max(0, Number(account.capital_available ?? 0) - allocated);
    const configuredEntry = body?.entry != null ? Number(body.entry) : NaN;
    const entry =
      Number.isFinite(configuredEntry) && configuredEntry > 0
        ? configuredEntry
        : Number(pool.entry_high ?? pool.entry_low ?? pool.target_price ?? 0);
    if (!Number.isFinite(entry) || entry <= 0)
      throw new BadRequestException('Pool entry price is invalid');

    const maxQuantity = Math.floor(availableAmount / entry);
    const requestedQuantity = body?.quantity == null ? maxQuantity : Number(body.quantity);
    const quantity = Math.floor(Math.max(0, requestedQuantity) / 100) * 100;
    const warning = quantity < 100;
    const targetPosition = quantity * entry;

    const { data: candidate, error: insertError } = await this.supabase.db
      .from('tce_buy_candidates')
      .insert({
        account_id: account.id,
        symbol: pool.symbol,
        rank: pool.rank,
        target_position: targetPosition,
        target_quantity: quantity,
        target_price: entry,
        status: warning ? 'queued' : 'ready',
        reason: `${pool.rationale ?? 'Promoted from pool'}${warning ? ' | WARNING: available amount is below one 100-share lot' : ''}`,
        score: pool.score,
        pool_entry_id: pool.id,
        promoted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(
        'id,account_id,symbol,rank,target_position,target_quantity,target_price,status,reason,score,pool_entry_id,promoted_at,created_at,updated_at'
      )
      .single();
    if (insertError) throw new BadRequestException(insertError.message);

    const { error: poolUpdateError } = await this.supabase.db
      .from('tce_pool_entries')
      .update({ status: 'PROMOTED', updated_at: new Date().toISOString() })
      .eq('id', pool.id)
      .eq('account_id', account.id);
    if (poolUpdateError) throw new BadRequestException(poolUpdateError.message);

    return {
      ...candidate,
      targetPosition: Number(candidate.target_position ?? 0),
      targetQuantity: Number(candidate.target_quantity ?? 0),
      targetPrice: Number(candidate.target_price ?? 0),
      score: candidate.score == null ? null : Number(candidate.score),
      expectedHoldDays:
        pool.expected_hold_days == null ? null : Number(pool.expected_hold_days),
      availableAmount,
      maxQuantity,
      orderLotSize: 100,
      quantityWarning: warning,
      quantityWarningMessage: warning
        ? `Available ${availableAmount.toLocaleString()} is not enough for 100 shares at entry ${entry.toLocaleString()}`
        : null,
    };
  }
}
