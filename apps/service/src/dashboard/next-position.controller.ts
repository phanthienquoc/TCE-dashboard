import {
  BadRequestException,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { SupabaseClientService } from '../db/supabase.client';

@Controller('dashboard/next-positions')
export class NextPositionController {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly jwt: JwtService
  ) {}

  @Post(':candidateId/return-to-pool')
  async returnToPool(
    @Headers('authorization') auth?: string,
    @Param('candidateId') candidateId?: string
  ) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    const userId = this.jwt.verify(auth.slice(7)).sub;
    const id = String(candidateId ?? '').trim();
    if (!id) throw new BadRequestException('Next Position candidate id is required');

    const { data: account, error: accountError } = await this.supabase.db
      .from('tce_accounts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (accountError) throw new BadRequestException(accountError.message);
    if (!account) throw new BadRequestException('TCE account is not configured');

    const { data: candidate, error: candidateError } = await this.supabase.db
      .from('tce_buy_candidates')
      .select('id,account_id,symbol,pool_entry_id,status')
      .eq('id', id)
      .eq('account_id', account.id)
      .single();
    if (candidateError || !candidate) throw new BadRequestException('Next Position not found');

    if (!['queued', 'ready'].includes(String(candidate.status ?? '').toLowerCase())) {
      throw new BadRequestException('This Next Position is no longer active');
    }

    if (!candidate.pool_entry_id) {
      throw new BadRequestException('This Next Position is not linked to a pool item');
    }

    const now = new Date().toISOString();
    const { data: pool, error: poolError } = await this.supabase.db
      .from('tce_pool_entries')
      .select('id,account_id,symbol,status')
      .eq('id', candidate.pool_entry_id)
      .eq('account_id', account.id)
      .single();
    if (poolError || !pool) throw new BadRequestException('Linked pool item not found');

    if (String(pool.symbol).toUpperCase() !== String(candidate.symbol).toUpperCase()) {
      throw new BadRequestException('Linked pool item does not match the Next Position');
    }

    // `skipped` is the existing terminal state allowed by
    // tce_buy_candidates_status_check. Do not invent a `returned` state.
    const { error: candidateUpdateError } = await this.supabase.db
      .from('tce_buy_candidates')
      .update({ status: 'skipped', updated_at: now })
      .eq('id', candidate.id)
      .eq('account_id', account.id)
      .in('status', ['queued', 'ready']);
    if (candidateUpdateError) throw new BadRequestException(candidateUpdateError.message);

    const { error: poolUpdateError } = await this.supabase.db
      .from('tce_pool_entries')
      .update({ status: 'WATCHING', updated_at: now })
      .eq('id', pool.id)
      .eq('account_id', account.id);
    if (poolUpdateError) throw new BadRequestException(poolUpdateError.message);

    return {
      ok: true,
      candidateId: candidate.id,
      poolEntryId: pool.id,
      symbol: candidate.symbol,
      status: 'WATCHING',
    };
  }
}
