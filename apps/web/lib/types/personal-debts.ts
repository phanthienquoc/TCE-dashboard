export type DebtBankCode = 'VPB' | 'VIB' | 'TPB' | 'TCB' | 'OTHER';
export type DebtType = 'loan' | 'card_installment' | 'credit_card' | 'bnpl' | 'other';
export type DebtStatus = 'active' | 'paid_off' | 'pending_verification' | 'overdue';
export type DebtConfidence = 'verified' | 'source_snapshot' | 'historical' | 'estimated' | 'needs_statement';

export interface PersonalDebt {
  id: string; user_id: string; bank_code: DebtBankCode; bank_name: string;
  debt_name: string; debt_type: DebtType; contract_no: string | null; status: DebtStatus;
  principal_original: number | null; principal_balance: number | null; app_remaining_amount: number | null;
  monthly_payment: number | null; monthly_principal: number | null; monthly_interest: number | null;
  interest_rate_monthly: number | null; interest_rate_annual: number | null;
  term_months: number | null; months_paid: number | null; months_remaining: number | null;
  next_due_date: string | null; disbursed_at: string | null;
  paid_amount_displayed: number | null; remaining_installments_total: number | null;
  data_confidence: DebtConfidence; source_note: string | null; as_of_date: string;
  created_at: string; updated_at: string;
}

export type PersonalDebtInsert = Omit<Partial<PersonalDebt>,
  'id' | 'user_id' | 'created_at' | 'updated_at'> & {
  bank_code: DebtBankCode; bank_name: string; debt_name: string; debt_type: DebtType;
};

export interface PersonalDebtDashboard {
  user_id: string; active_contracts: number; indicative_remaining_total: number;
  estimated_monthly_due_total: number; records_need_verification: number;
}

/** Drop-in Supabase Database type for personal_debts tables and dashboard view. */
export interface PersonalDebtDatabase {
  public: {
    Tables: {
      personal_debts: {
        Row: PersonalDebt;
        Insert: PersonalDebtInsert & { user_id: string };
        Update: Partial<PersonalDebtInsert>;
        Relationships: [];
      };
    };
    Views: { personal_debt_dashboard: { Row: PersonalDebtDashboard; Relationships: [] } };
    Functions: {}; Enums: {}; CompositeTypes: {};
  };
}
