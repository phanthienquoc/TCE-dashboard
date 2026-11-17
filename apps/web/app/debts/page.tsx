'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, Wallet, X } from 'lucide-react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useAuthStore } from '../../lib/store';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import type {
  PersonalDebt,
  PersonalDebtInsert,
  DebtBankCode,
  DebtType,
} from '../../lib/types/personal-debts';

type Filter = 'all' | DebtBankCode | 'needs_review';
type DebtFormState = {
  bank_code: DebtBankCode;
  debt_name: string;
  debt_type: DebtType;
  contract_no: string;
  principal_original: string;
  principal_balance: string;
  monthly_payment: string;
  monthly_principal: string;
  monthly_interest: string;
  interest_rate_annual: string;
  term_months: string;
  months_paid: string;
  months_remaining: string;
  disbursed_at: string;
  next_due_date: string;
  data_confidence: string;
  source_note: string;
};
const emptyForm: DebtFormState = {
  bank_code: 'VPB',
  debt_name: '',
  debt_type: 'loan',
  contract_no: '',
  principal_original: '',
  principal_balance: '',
  monthly_payment: '',
  monthly_principal: '',
  monthly_interest: '',
  interest_rate_annual: '',
  term_months: '',
  months_paid: '',
  months_remaining: '',
  disbursed_at: '',
  next_due_date: '',
  data_confidence: 'needs_statement',
  source_note: '',
};
const bankNames: Record<DebtBankCode, string> = {
  VPB: 'VPBank',
  VIB: 'VIB',
  TPB: 'TPBank',
  TCB: 'Techcombank',
  OTHER: 'Ngân hàng khác',
};
const typeLabel: Record<DebtType, string> = {
  loan: 'Khoản vay',
  card_installment: 'Trả góp thẻ',
  credit_card: 'Thẻ tín dụng',
  bnpl: 'Mua trước trả sau',
  other: 'Khác',
};
const money = (value: number | null | undefined) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(value);
const num = (value: string) => (value.trim() === '' ? null : Number(value));

export default function DebtsPage() {
  const { user, initialized, init } = useAuthStore();
  const toast = useToast();
  const [rows, setRows] = useState<PersonalDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DebtFormState>(emptyForm);

  useEffect(() => {
    if (!initialized) void init();
  }, [initialized, init]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/debts');
      const records = (Array.isArray(response.data) ? response.data : []) as PersonalDebt[];
      setRows(records);
      setSelectedId(current =>
        current && records.some(r => r.id === current)
          ? current
          : (records.find(r => r.bank_code !== 'TCB')?.id ?? null)
      );
    } catch (e: any) {
      const message =
        e?.response?.data?.message ?? e?.message ?? 'Không tải được dữ liệu khoản nợ.';
      setError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (initialized && user) void load();
  }, [initialized, user, load]);

  const debtRows = useMemo(() => rows.filter(r => r.bank_code !== 'TCB'), [rows]);
  const summary = useMemo(() => {
    const active = debtRows.filter(r => r.status === 'active');
    return {
      total: active.reduce(
        (s, r) =>
          s +
          Number(
            r.principal_balance ?? r.app_remaining_amount ?? r.remaining_installments_total ?? 0
          ),
        0
      ),
      monthly: active.reduce((s, r) => s + Number(r.monthly_payment ?? 0), 0),
      count: active.length,
      review: active.filter(r => r.data_confidence !== 'verified').length,
    };
  }, [debtRows]);
  const filtered = useMemo(
    () =>
      debtRows.filter(r => {
        const matches = [r.bank_name, r.debt_name, r.contract_no ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase());
        const byFilter =
          filter === 'all'
            ? true
            : filter === 'needs_review'
              ? r.data_confidence !== 'verified'
              : r.bank_code === filter;
        return matches && byFilter;
      }),
    [debtRows, filter, query]
  );
  const selected =
    rows.find(r => r.id === selectedId && r.bank_code !== 'TCB') ?? filtered[0] ?? null;
  const groups = useMemo(
    () =>
      ['VPB', 'VIB', 'TPB', 'OTHER']
        .map(code => ({
          code,
          name: bankNames[code as DebtBankCode],
          records: filtered.filter(r => r.bank_code === code),
        }))
        .filter(g => g.records.length),
    [filtered]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (!form.debt_name.trim()) {
      toast('Nhập tên khoản nợ.', 'error');
      return;
    }
    const payload: PersonalDebtInsert = {
      bank_code: form.bank_code,
      bank_name: bankNames[form.bank_code],
      debt_name: form.debt_name.trim(),
      debt_type: form.debt_type,
      contract_no: form.contract_no.trim() || null,
      principal_original: num(form.principal_original),
      principal_balance: num(form.principal_balance),
      monthly_payment: num(form.monthly_payment),
      monthly_principal: num(form.monthly_principal),
      monthly_interest: num(form.monthly_interest),
      interest_rate_annual: num(form.interest_rate_annual),
      term_months: num(form.term_months),
      months_paid: num(form.months_paid),
      months_remaining: num(form.months_remaining),
      disbursed_at: form.disbursed_at || null,
      next_due_date: form.next_due_date || null,
      data_confidence: form.data_confidence as any,
      source_note: form.source_note.trim() || null,
      status: 'active',
      as_of_date: '2026-11-18',
    };
    setSaving(true);
    try {
      await api.post('/debts', payload);
      toast('Đã lưu khoản nợ.', 'success');
      setFormOpen(false);
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      toast(
        e?.response?.data?.message ??
          e?.message ??
          'Không lưu được khoản nợ. Kiểm tra quyền API/RLS.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };
  const setField = (key: keyof DebtFormState, value: string) =>
    setForm(current => ({ ...current, [key]: value }));

  return (
    <DashboardLayout activeId="debts">
      <div className="debt-page">
        <header className="debt-header">
          <div>
            <h1 className="debt-title">Quản lý khoản nợ</h1>
            <p className="debt-subtitle">Hợp đồng, trả góp và kỳ thanh toán theo từng ngân hàng</p>
          </div>
          <Button
            onClick={() => {
              setForm(emptyForm);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Thêm khoản nợ
          </Button>
        </header>

        <section className="debt-main-summary" aria-label="Tổng quan nợ">
          <div className="debt-summary-primary">
            <span className="debt-summary-label">Dư nợ còn lại · bỏ qua TCB</span>
            <strong className="debt-summary-value">{money(summary.total)}</strong>
            <div className="debt-inline-metrics">
              <span>{summary.count} khoản hoạt động</span>
              <span>
                <strong>{money(summary.monthly)}</strong> / tháng
              </span>
            </div>
          </div>
          <div className="debt-summary-item">
            <span className="debt-summary-label">Thanh toán mỗi tháng</span>
            <strong className="debt-summary-value">{money(summary.monthly)}</strong>
          </div>
          <div className="debt-summary-item">
            <span className="debt-summary-label">Cần đối chiếu</span>
            <strong className="debt-summary-value">{summary.review}</strong>
          </div>
        </section>

        <div className="debt-toolbar">
          <div className="debt-toolbar-left">
            <div className="debt-search">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Tìm ngân hàng, hợp đồng..."
                aria-label="Tìm khoản nợ"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Tải lại"
            >
              <RefreshCw className={'size-4 ' + (loading ? 'animate-spin' : '')} />
            </Button>
          </div>
          <Tabs value={filter} onValueChange={v => setFilter(v as Filter)}>
            <TabsList className="debt-tabs">
              <TabsTrigger value="all">Tất cả</TabsTrigger>
              <TabsTrigger value="VPB">VPB</TabsTrigger>
              <TabsTrigger value="VIB">VIB</TabsTrigger>
              <TabsTrigger value="TPB">TPB</TabsTrigger>
              <TabsTrigger value="needs_review">Cần rà soát</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {error && <div className="error-banner">{error}</div>}
        <div className="debt-layout">
          <section className="debt-panel" aria-label="Danh sách khoản nợ">
            <div className="debt-panel-heading">
              <div>
                <h2>Các khoản đang theo dõi</h2>
                <p>{filtered.length} hợp đồng · không gộp khoản</p>
              </div>
            </div>
            {loading ? (
              <div className="debt-empty">Đang tải danh sách…</div>
            ) : filtered.length === 0 ? (
              <div className="debt-empty">Không tìm thấy khoản nợ phù hợp.</div>
            ) : (
              groups.map(group => (
                <div className="debt-bank-group" key={group.code}>
                  <div className="debt-bank-heading">
                    <strong>
                      {group.name} <span className="debt-status">{group.code}</span>
                    </strong>
                    <span>{group.records.length} khoản</span>
                  </div>
                  {group.records.map(row => (
                    <button
                      type="button"
                      key={row.id}
                      className="debt-record"
                      aria-pressed={selected?.id === row.id}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <div>
                        <div className="debt-record-name">{row.debt_name}</div>
                        <div className="debt-record-meta">
                          <span>{typeLabel[row.debt_type]}</span>
                          {row.contract_no && <span>HĐ {row.contract_no}</span>}
                          <span
                            className={
                              'debt-status ' +
                              (row.status === 'overdue'
                                ? 'danger'
                                : row.data_confidence === 'verified'
                                  ? 'ok'
                                  : 'warn')
                            }
                          >
                            {row.status === 'active'
                              ? 'Đang trả'
                              : row.status === 'overdue'
                                ? 'Quá hạn'
                                : row.status === 'paid_off'
                                  ? 'Đã tất toán'
                                  : 'Chờ xác minh'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="debt-record-balance">
                          {money(
                            row.principal_balance ??
                              row.app_remaining_amount ??
                              row.remaining_installments_total
                          )}
                        </div>
                        <div className="debt-record-month">
                          {row.monthly_payment == null
                            ? 'Chưa có kỳ/tháng'
                            : money(row.monthly_payment) + ' / tháng'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
            <div className="debt-panel-heading">
              <div>
                <h2>Khoản đã tất toán</h2>
                <p>Lịch sử được giữ riêng, không cộng vào dư nợ</p>
              </div>
            </div>
            {rows.filter(r => r.status === 'paid_off' && r.bank_code !== 'TCB').length === 0 ? (
              <div className="debt-empty">Chưa có khoản nào được đánh dấu tất toán.</div>
            ) : (
              <div className="debt-empty">
                {rows.filter(r => r.status === 'paid_off' && r.bank_code !== 'TCB').length} khoản đã
                tất toán.
              </div>
            )}
          </section>

          <section className="debt-panel" aria-label="Chi tiết khoản nợ">
            {selected ? (
              <>
                <div className="debt-panel-heading">
                  <div>
                    <h2>Chi tiết khoản nợ</h2>
                    <p>
                      {selected.bank_name} · {typeLabel[selected.debt_type]}
                    </p>
                  </div>
                  <span className="debt-status warn">
                    {selected.data_confidence === 'verified'
                      ? 'Đã đối chiếu'
                      : selected.data_confidence === 'estimated'
                        ? 'Ước tính'
                        : 'Cần rà soát'}
                  </span>
                </div>
                <div className="debt-detail">
                  <div className="debt-detail-top">
                    <div>
                      <h3>{selected.debt_name}</h3>
                      <div className="debt-record-meta">
                        {selected.contract_no
                          ? 'Hợp đồng ' + selected.contract_no
                          : 'Chưa có mã hợp đồng'}
                      </div>
                    </div>
                    <Wallet className="size-5" />
                  </div>
                  <div>
                    <span className="debt-summary-label">Dư gốc / số còn lại đã nhập</span>
                    <div className="debt-detail-amount">
                      {money(
                        selected.principal_balance ??
                          selected.app_remaining_amount ??
                          selected.remaining_installments_total
                      )}
                    </div>
                  </div>
                  <div className="debt-detail-grid">
                    <div className="debt-detail-field">
                      <span>Gốc ban đầu</span>
                      <strong>{money(selected.principal_original)}</strong>
                    </div>
                    <div className="debt-detail-field">
                      <span>Phải trả / tháng</span>
                      <strong>{money(selected.monthly_payment)}</strong>
                    </div>
                    <div className="debt-detail-field">
                      <span>Gốc / tháng</span>
                      <strong>{money(selected.monthly_principal)}</strong>
                    </div>
                    <div className="debt-detail-field">
                      <span>Lãi / tháng</span>
                      <strong>{money(selected.monthly_interest)}</strong>
                    </div>
                    <div className="debt-detail-field">
                      <span>Lãi suất năm</span>
                      <strong>
                        {selected.interest_rate_annual == null
                          ? '—'
                          : selected.interest_rate_annual + '%'}
                      </strong>
                    </div>
                    <div className="debt-detail-field">
                      <span>Đã đóng / tổng kỳ</span>
                      <strong>
                        {selected.months_paid ?? '—'} / {selected.term_months ?? '—'}
                      </strong>
                    </div>
                    <div className="debt-detail-field">
                      <span>Còn lại</span>
                      <strong>
                        {selected.months_remaining == null
                          ? '—'
                          : selected.months_remaining + ' kỳ'}
                      </strong>
                    </div>
                    <div className="debt-detail-field">
                      <span>Kỳ đến hạn tiếp</span>
                      <strong>{selected.next_due_date ?? '—'}</strong>
                    </div>
                    <div className="debt-detail-field">
                      <span>Ngày giải ngân</span>
                      <strong>{selected.disbursed_at ?? '—'}</strong>
                    </div>
                    <div className="debt-detail-field">
                      <span>Đã trả hiển thị</span>
                      <strong>{money(selected.paid_amount_displayed)}</strong>
                    </div>
                  </div>
                  {selected.source_note && (
                    <div className="debt-info-note">{selected.source_note}</div>
                  )}
                  <div className="debt-disclaimer">
                    Không dùng thanh tiến độ để suy ra số tháng đã đóng. Các trường chưa có căn cứ
                    được để trống.
                  </div>
                </div>
              </>
            ) : (
              <div className="debt-empty">Chọn một hợp đồng để xem chi tiết.</div>
            )}
          </section>
        </div>

        {formOpen && (
          <div
            className="trade-overlay"
            role="presentation"
            onMouseDown={e => {
              if (e.target === e.currentTarget && !saving) setFormOpen(false);
            }}
          >
            <section
              className="trade-ticket"
              role="dialog"
              aria-modal="true"
              aria-labelledby="debt-form-title"
            >
              <div className="debt-detail-top">
                <h2 id="debt-form-title" className="tce-title-3">
                  Thêm khoản nợ
                </h2>
                <button
                  className="icon-button touch-target"
                  type="button"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                  aria-label="Đóng"
                >
                  <X className="size-4" />
                </button>
              </div>
              <form className="debt-form" onSubmit={submit}>
                <div className="debt-form-grid">
                  <div className="debt-field">
                    <label htmlFor="debt-bank">Ngân hàng</label>
                    <select
                      id="debt-bank"
                      value={form.bank_code}
                      onChange={e => setField('bank_code', e.target.value as DebtBankCode)}
                    >
                      {Object.entries(bankNames).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-type">Loại khoản nợ</label>
                    <select
                      id="debt-type"
                      value={form.debt_type}
                      onChange={e => setField('debt_type', e.target.value as DebtType)}
                    >
                      {Object.entries(typeLabel).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="debt-field" style={{ gridColumn: '1/-1' }}>
                    <label htmlFor="debt-name">Tên khoản nợ</label>
                    <input
                      id="debt-name"
                      required
                      value={form.debt_name}
                      onChange={e => setField('debt_name', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-contract">Số hợp đồng</label>
                    <input
                      id="debt-contract"
                      value={form.contract_no}
                      onChange={e => setField('contract_no', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-original">Gốc ban đầu</label>
                    <input
                      id="debt-original"
                      type="number"
                      min="0"
                      value={form.principal_original}
                      onChange={e => setField('principal_original', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-balance">Gốc còn lại</label>
                    <input
                      id="debt-balance"
                      type="number"
                      min="0"
                      value={form.principal_balance}
                      onChange={e => setField('principal_balance', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-monthly">Phải trả / tháng</label>
                    <input
                      id="debt-monthly"
                      type="number"
                      min="0"
                      value={form.monthly_payment}
                      onChange={e => setField('monthly_payment', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-monthly-principal">Gốc / tháng</label>
                    <input
                      id="debt-monthly-principal"
                      type="number"
                      min="0"
                      value={form.monthly_principal}
                      onChange={e => setField('monthly_principal', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-monthly-interest">Lãi / tháng</label>
                    <input
                      id="debt-monthly-interest"
                      type="number"
                      min="0"
                      value={form.monthly_interest}
                      onChange={e => setField('monthly_interest', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-rate">Lãi suất năm (%)</label>
                    <input
                      id="debt-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.interest_rate_annual}
                      onChange={e => setField('interest_rate_annual', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-term">Tổng số kỳ</label>
                    <input
                      id="debt-term"
                      type="number"
                      min="0"
                      value={form.term_months}
                      onChange={e => setField('term_months', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-paid">Đã đóng</label>
                    <input
                      id="debt-paid"
                      type="number"
                      min="0"
                      value={form.months_paid}
                      onChange={e => setField('months_paid', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-left">Còn lại</label>
                    <input
                      id="debt-left"
                      type="number"
                      min="0"
                      value={form.months_remaining}
                      onChange={e => setField('months_remaining', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-disbursed">Ngày giải ngân</label>
                    <input
                      id="debt-disbursed"
                      type="date"
                      value={form.disbursed_at}
                      onChange={e => setField('disbursed_at', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-due">Ngày đến hạn</label>
                    <input
                      id="debt-due"
                      type="date"
                      value={form.next_due_date}
                      onChange={e => setField('next_due_date', e.target.value)}
                    />
                  </div>
                  <div className="debt-field">
                    <label htmlFor="debt-confidence">Mức xác nhận</label>
                    <select
                      id="debt-confidence"
                      value={form.data_confidence}
                      onChange={e => setField('data_confidence', e.target.value)}
                    >
                      <option value="verified">Đã đối chiếu</option>
                      <option value="source_snapshot">Theo ảnh chụp</option>
                      <option value="estimated">Ước tính</option>
                      <option value="needs_statement">Cần sao kê</option>
                    </select>
                  </div>
                  <div className="debt-field" style={{ gridColumn: '1/-1' }}>
                    <label htmlFor="debt-note">Ghi chú / căn cứ số liệu</label>
                    <textarea
                      id="debt-note"
                      value={form.source_note}
                      onChange={e => setField('source_note', e.target.value)}
                    />
                  </div>
                </div>
                <p className="debt-disclaimer">
                  Chỉ nhập số liệu theo hợp đồng hoặc ứng dụng ngân hàng. Số tháng đã đóng không tự
                  suy ra từ progress bar.
                </p>
                <div className="debt-actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormOpen(false)}
                    disabled={saving}
                  >
                    Huỷ
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Đang lưu…' : 'Lưu khoản nợ'}
                  </Button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
