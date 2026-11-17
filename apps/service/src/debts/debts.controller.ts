import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import { SupabaseClientService } from '../db/supabase.client';

const BANK_CODES = ['VPB', 'VIB', 'TPB', 'TCB', 'OTHER'] as const;
const DEBT_TYPES = ['loan', 'card_installment', 'credit_card', 'bnpl', 'other'] as const;
const STATUSES = ['active', 'paid_off', 'pending_verification', 'overdue'] as const;
const CONFIDENCE = ['verified', 'source_snapshot', 'historical', 'estimated', 'needs_statement'] as const;

type DebtRow = {
  id: string;
  user_id: string;
  bank_code: string;
  bank_name: string;
  debt_name: string;
  debt_type: string;
  contract_no: string | null;
  status: string;
  principal_original: number | null;
  principal_balance: number | null;
  app_remaining_amount: number | null;
  monthly_payment: number | null;
  monthly_principal: number | null;
  monthly_interest: number | null;
  interest_rate_monthly: number | null;
  interest_rate_annual: number | null;
  term_months: number | null;
  months_paid: number | null;
  months_remaining: number | null;
  next_due_date: string | null;
  disbursed_at: string | null;
  paid_amount_displayed: number | null;
  remaining_installments_total: number | null;
  data_confidence: string;
  source_note: string | null;
  as_of_date: string;
  created_at: string;
  updated_at: string;
};

@Controller('debts')
export class DebtsController {
  constructor(
    private readonly jwt: JwtService,
    private readonly supabase: SupabaseClientService
  ) {}

  private userId(auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    return this.jwt.verify(auth.slice(7)).sub;
  }

  @Get()
  async list(@Headers('authorization') auth?: string, @Query('includeTcb') includeTcb?: string) {
    const userId = this.userId(auth);
    let query = this.supabase.db
      .from('personal_debts')
      .select('*')
      .eq('user_id', userId)
      .order('bank_code', { ascending: true })
      .order('created_at', { ascending: true });
    if (includeTcb !== 'true') query = query.neq('bank_code', 'TCB');
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  @Post()
  async create(@Headers('authorization') auth: string | undefined, @Body() body: Record<string, unknown>) {
    const userId = this.userId(auth);
    const payload = this.validate(body);
    const { data, error } = await this.supabase.db
      .from('personal_debts')
      .insert({ ...payload, user_id: userId })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  @Patch(':id')
  async update(
    @Headers('authorization') auth: string | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>
  ) {
    const userId = this.userId(auth);
    const payload = this.validate(body, true);
    const { data, error } = await this.supabase.db
      .from('personal_debts')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new UnauthorizedException('Debt record not found');
    return data;
  }

  @Delete(':id')
  async remove(@Headers('authorization') auth: string | undefined, @Param('id') id: string) {
    const userId = this.userId(auth);
    const { error, count } = await this.supabase.db
      .from('personal_debts')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return { ok: true, deleted: count ?? 0 };
  }

  private validate(body: Record<string, unknown>, partial = false) {
    const allowed = [
      'bank_code','bank_name','debt_name','debt_type','contract_no','status',
      'principal_original','principal_balance','app_remaining_amount','monthly_payment',
      'monthly_principal','monthly_interest','interest_rate_monthly','interest_rate_annual',
      'term_months','months_paid','months_remaining','next_due_date','disbursed_at',
      'paid_amount_displayed','remaining_installments_total','data_confidence','source_note','as_of_date'
    ];
    const input = Object.fromEntries(Object.entries(body ?? {}).filter(([key]) => allowed.includes(key)));
    if (!partial || 'bank_code' in input) {
      if (!BANK_CODES.includes(input.bank_code as any)) throw new UnauthorizedException('Invalid bank code');
    }
    if (!partial || 'debt_type' in input) {
      if (!DEBT_TYPES.includes(input.debt_type as any)) throw new UnauthorizedException('Invalid debt type');
    }
    if ('status' in input && !STATUSES.includes(input.status as any)) throw new UnauthorizedException('Invalid debt status');
    if ('data_confidence' in input && !CONFIDENCE.includes(input.data_confidence as any)) throw new UnauthorizedException('Invalid data confidence');
    for (const key of [
      'principal_original','principal_balance','app_remaining_amount','monthly_payment','monthly_principal',
      'monthly_interest','interest_rate_monthly','interest_rate_annual','term_months','months_paid','months_remaining',
      'paid_amount_displayed','remaining_installments_total'
    ]) {
      const value = input[key];
      if (value !== undefined && value !== null && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        throw new UnauthorizedException('Invalid non-negative numeric field: ' + key);
      }
    }
    if (!partial) {
      for (const key of ['bank_name','debt_name']) {
        if (typeof input[key] !== 'string' || !(input[key] as string).trim()) throw new UnauthorizedException(key + ' is required');
      }
    }
    return input;
  }
}
