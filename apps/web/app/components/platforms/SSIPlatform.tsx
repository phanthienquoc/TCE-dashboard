'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  FileJson,
  KeyRound,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
  XCircle,
  Zap,
} from 'lucide-react';
import { platformApi } from '../../../lib/api';

type Credentials = { clientId: string; apiKey: string; apiSecret: string; privateKey: string };
type Props = { onMessage?: (message: string) => void };
type ResultState = { ok: boolean; message: string } | null;
type AuthStep = 'credentials' | 'approval' | 'approved';

const initialCredentials: Credentials = { clientId: '', apiKey: '', apiSecret: '', privateKey: '' };
const ENVIRONMENT = 'production';
const APPROVAL_POLL_MS = 5000;

const pick = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
};

function credentialsFromJson(value: unknown): Credentials {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('JSON root must be an object');
  const root = value as Record<string, unknown>;
  const nested =
    root.credentials && typeof root.credentials === 'object' && !Array.isArray(root.credentials)
      ? (root.credentials as Record<string, unknown>)
      : {};
  const source = { ...root, ...nested };
  return {
    clientId: pick(source, 'clientId', 'client_id', 'clientID'),
    apiKey: pick(source, 'apiKey', 'api_key', 'apiKEY'),
    apiSecret: pick(source, 'apiSecret', 'api_secret', 'apiSECRET'),
    privateKey: pick(source, 'privateKey', 'private_key', 'privateKEY'),
  };
}

export default function SSIPlatform({ onMessage }: Props) {
  const [open, setOpen] = useState(true);
  const [credentials, setCredentials] = useState<Credentials>(initialCredentials);
  const [accountNo, setAccountNo] = useState('');
  const [otp, setOtp] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [authStep, setAuthStep] = useState<AuthStep>('credentials');
  const [approvalChecking, setApprovalChecking] = useState(false);
  const [tested, setTested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResultState>(null);
  const [fileName, setFileName] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAuthChallenge = () => {
    setOtp('');
    setTransactionId('');
    setAccountNo('');
    setAuthStep('credentials');
    setTested(false);
  };

  const updateCredential = (key: keyof Credentials, value: string) => {
    setCredentials(current => ({ ...current, [key]: value }));
    resetAuthChallenge();
    setResult(null);
    setFileName('');
  };

  const messageFrom = (error: unknown) => {
    const value = error as {
      response?: { data?: { message?: string; error?: { message?: string } } };
      message?: string;
    };
    return (
      value?.response?.data?.message ??
      value?.response?.data?.error?.message ??
      value?.message ??
      'Request failed'
    );
  };

  const requestOtp = async () => {
    if (
      !credentials.clientId.trim() ||
      !credentials.apiKey.trim() ||
      !credentials.apiSecret.trim() ||
      !credentials.privateKey.trim()
    ) {
      setResult({
        ok: false,
        message: 'Client ID, API Key, API Secret and Private Key are required before requesting SSI approval.',
      });
      return false;
    }
    setBusy(true);
    setResult(null);
    setTested(false);
    try {
      const response = await platformApi.ssiOtp({ environment: ENVIRONMENT, credentials });
      const nextTransactionId =
        response.data?.data?.transactionId ?? response.data?.transactionId ?? '';
      if (!nextTransactionId) throw new Error('SSI did not return a transaction ID. Please try again.');
      setTransactionId(nextTransactionId);
      setOtp('');
      setAuthStep('approval');
      setResult({
        ok: true,
        message: 'SSI login request sent. Approve it in SSI iBoard/app. Approval status will be checked automatically.',
      });
      onMessage?.('SSI authentication challenge requested');
      return true;
    } catch (error) {
      const message = messageFrom(error);
      setResult({ ok: false, message: `SSI authentication request failed: ${message}` });
      onMessage?.(`SSI authentication request failed: ${message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const checkApproval = async (silent = false) => {
    if (!transactionId && !otp.trim()) return false;
    setApprovalChecking(true);
    if (!silent) setResult(null);
    try {
      const response = await platformApi.ssiApprove({
        environment: ENVIRONMENT,
        credentials,
        otp: otp.trim() || undefined,
        transactionId: transactionId.trim() || undefined,
      });
      const data = response.data;
      if (!data?.ok) {
        if (!silent) setResult({ ok: false, message: data?.error?.message ?? 'SSI approval is still pending.' });
        return false;
      }
      setAuthStep('approved');
      setResult({ ok: true, message: 'SSI approval confirmed. You can now test and save the connection.' });
      onMessage?.('SSI approval confirmed');
      return true;
    } catch (error) {
      const message = messageFrom(error);
      if (!silent) setResult({ ok: false, message: `Waiting for SSI approval: ${message}` });
      return false;
    } finally {
      setApprovalChecking(false);
    }
  };

  useEffect(() => {
    if (authStep !== 'approval' || !transactionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (cancelled) return;
      const approved = await checkApproval(true);
      if (!cancelled && !approved) timer = setTimeout(poll, APPROVAL_POLL_MS);
    };
    timer = setTimeout(poll, APPROVAL_POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [authStep, transactionId]);

  const uploadJson = async (file?: File) => {
    if (!file) return;
    setResult(null);
    setFileName('');
    resetAuthChallenge();
    try {
      if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json')
        throw new Error('Please select a JSON file');
      const parsed = JSON.parse(await file.text());
      const next = credentialsFromJson(parsed);
      const found = Object.values(next).filter(Boolean).length;
      if (!next.clientId || !next.apiKey || !next.apiSecret || !next.privateKey)
        throw new Error('JSON must contain Client ID, API Key, API Secret and Private Key');
      setCredentials(next);
      setFileName(file.name);
      setResult({
        ok: true,
        message: `Loaded ${found}/4 credential fields from ${file.name}. Review them, then request SSI approval.`,
      });
      onMessage?.(`Loaded SSI credentials from ${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : messageFrom(error);
      setResult({ ok: false, message });
      onMessage?.(`JSON upload failed: ${message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const testConnection = async () => {
    if (authStep !== 'approved') {
      setResult({ ok: false, message: 'Approve the SSI login request first.' });
      return;
    }
    setBusy(true);
    setTested(false);
    setResult(null);
    try {
      const response = await platformApi.ssiTest({ environment: ENVIRONMENT, credentials });
      const data = response.data;
      if (!data?.ok) throw new Error(data?.error?.message ?? 'SSI connection failed');
      const accounts = Array.isArray(data?.data?.accounts) ? data.data.accounts : [];
      const selectedAccount = accounts[0]?.accountNo ?? data?.data?.accountNo ?? '';
      setAccountNo(String(selectedAccount));
      setTested(true);
      setResult({
        ok: true,
        message: accounts.length ? `SSI connection verified — ${accounts.length} account(s) loaded.` : 'SSI connection verified.',
      });
      onMessage?.('SSI connection verified');
    } catch (error) {
      const message = messageFrom(error);
      setResult({ ok: false, message });
      onMessage?.(`SSI connection failed: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  const testOrder = async () => {
    if (!tested || !accountNo) {
      setResult({ ok: false, message: 'Test Connection must succeed and return an SSI account before placing the test order.' });
      return;
    }
    const confirmed = window.confirm(`Place a REAL SSI production test order: BUY 100 DPM using MTL on account ${accountNo}?`);
    if (!confirmed) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await platformApi.ssiOrder({ environment: ENVIRONMENT, accountNo, symbol: 'DPM', side: 'BUY', quantity: 100, orderType: 'MTL' });
      const data = response.data;
      if (!data?.ok) throw new Error(data?.error?.message ?? 'SSI test order failed');
      const orderId = data?.data?.orderId;
      setResult({ ok: true, message: orderId ? `SSI test order submitted successfully — DPM BUY 100, order ${orderId}.` : 'SSI test order submitted successfully — DPM BUY 100.' });
      onMessage?.('SSI test order submitted');
    } catch (error) {
      const message = messageFrom(error);
      setResult({ ok: false, message: `SSI test order failed: ${message}` });
      onMessage?.(`SSI test order failed: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!tested || !accountNo) {
      setResult({ ok: false, message: 'Test Connection must succeed and return an SSI account before saving.' });
      return;
    }
    setBusy(true);
    try {
      const response = await platformApi.ssiSaveTested({ environment: ENVIRONMENT, credentials, accountNo, otp: otp.trim() || undefined, transactionId: transactionId.trim() || undefined });
      const data = response.data;
      if (!data?.ok) {
        setResult({ ok: false, message: data?.error?.message ?? 'SSI save failed' });
        return;
      }
      setResult({ ok: true, message: 'SSI credentials, Client ID and verified session saved securely.' });
      onMessage?.('SSI credentials saved');
    } catch (error) {
      const message = messageFrom(error);
      setResult({ ok: false, message });
      onMessage?.(`SSI save failed: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  const resetFlow = () => {
    setOtp('');
    setTransactionId('');
    setAccountNo('');
    setAuthStep('credentials');
    setTested(false);
    setResult(null);
  };

  return (
    <section className="mb-5 overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0d1d24] shadow-[0_20px_60px_rgba(0,0,0,.2)]">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex w-full items-center gap-3 border-b border-white/[0.06] px-5 py-4 text-left sm:px-6"
        aria-expanded={open}
      >
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#ef3340] text-white shadow-[0_8px_24px_rgba(239,51,64,.18)]">
          <span className="text-lg font-medium tracking-tight">SSI</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold tracking-tight text-white sm:text-lg">SSI FastConnect</p>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.07] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Production</span>
          </div>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">Connect to SSI via FastConnect API</p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400">
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <StepIndicator number="1" title="Credentials" subtitle="Provide API credentials" active={authStep === 'credentials'} done={authStep !== 'credentials'} />
            <div className={`h-px w-8 sm:w-16 ${authStep !== 'credentials' ? 'bg-sky-400/60' : 'bg-slate-600'}`} />
            <StepIndicator number="2" title="SSI approval" subtitle="Request authentication" active={authStep !== 'credentials'} done={authStep === 'approved'} />
          </div>

          {authStep === 'credentials' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-sky-400/60 bg-sky-400/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-400/15 text-sky-300"><CircleHelp className="size-4" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-sky-300">How to get credentials?</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">Log in to the SSI FastConnect portal, create an application and generate API credentials.</p>
                  </div>
                </div>
              </div>

              <div>
                <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => void uploadJson(event.target.files?.[0])} />
                <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()} className="group flex min-h-20 w-full items-center gap-4 rounded-2xl border border-dashed border-slate-600 bg-[#09171d] px-4 text-left transition hover:border-sky-400/60 hover:bg-sky-400/[0.03] disabled:opacity-50 sm:px-5">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><Upload className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100">Or upload from file</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">Upload a JSON file (e.g. ssi_credentials.json)</p>
                  </div>
                  <span className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 sm:inline-flex">Choose file</span>
                </button>
                {fileName && <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] px-3 py-2 text-xs text-emerald-300"><FileJson className="size-4 shrink-0" /><span className="truncate">{fileName}</span><Check className="size-3.5 shrink-0" /></div>}
              </div>

              <div className="space-y-3">
                <CredentialField label="Client ID" hint="Unique application identifier">
                  <CredentialInput value={credentials.clientId} onChange={value => updateCredential('clientId', value)} onCopy={() => void navigator.clipboard?.writeText(credentials.clientId)} />
                </CredentialField>
                <CredentialField label="API Key" hint="Public API credential">
                  <CredentialInput value={credentials.apiKey} onChange={value => updateCredential('apiKey', value)} onCopy={() => void navigator.clipboard?.writeText(credentials.apiKey)} />
                </CredentialField>
                <CredentialField label="API Secret" hint="Keep this value private">
                  <CredentialInput type={showSecret ? 'text' : 'password'} value={credentials.apiSecret} onChange={value => updateCredential('apiSecret', value)} onToggleVisibility={() => setShowSecret(value => !value)} visible={showSecret} />
                </CredentialField>
                <CredentialField label="Private Key" hint="PEM / signing key">
                  <CredentialInput multiline type={showPrivateKey ? 'text' : 'password'} value={credentials.privateKey} onChange={value => updateCredential('privateKey', value)} onCopy={() => void navigator.clipboard?.writeText(credentials.privateKey)} onToggleVisibility={() => setShowPrivateKey(value => !value)} visible={showPrivateKey} />
                </CredentialField>
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <button type="button" disabled={busy} onClick={() => void requestOtp()} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,165,233,.18)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Request SSI approval
                </button>
              </div>
            </div>
          )}

          {authStep === 'approval' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
                <div className="flex items-start gap-3">
                  {approvalChecking ? <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-amber-300" /> : <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-300" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-amber-100">Waiting for SSI approval</p>
                    <p className="mt-1 text-sm leading-5 text-amber-100/70">Open SSI iBoard/app and approve the login request. Approval is checked automatically every 5 seconds.</p>
                    <p className="mt-3 break-all text-[11px] text-amber-100/45">Transaction ID: {transactionId}</p>
                  </div>
                </div>
              </div>
              <CredentialField label="OTP" hint="Only if SSI asks for OTP">
                <input className="h-12 w-full rounded-xl border border-white/10 bg-[#09171d] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400/60" inputMode="numeric" value={otp} onChange={event => { setOtp(event.target.value); setResult(null); }} placeholder="Enter OTP from SSI" autoComplete="one-time-code" />
              </CredentialField>
              <div className="flex flex-col gap-2 sm:flex-row">
                <ActionButton disabled={approvalChecking || busy} onClick={() => void checkApproval(false)} primary>{approvalChecking ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Check approval</ActionButton>
                <ActionButton disabled={busy} onClick={resetFlow}><RotateCcw className="size-4" /> Start over</ActionButton>
              </div>
            </div>
          )}

          {authStep === 'approved' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
                <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" /><div><p className="font-semibold text-emerald-100">SSI approval confirmed</p><p className="mt-1 text-sm leading-5 text-emerald-100/70">The SSI authentication request was approved. Test the connection before saving.</p></div></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ActionButton disabled={busy} onClick={() => void testConnection()} primary>{busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Test Connection</ActionButton>
                <ActionButton disabled={busy || !tested || !accountNo} onClick={() => void testOrder()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Test Order</ActionButton>
                <ActionButton disabled={busy || !tested || !accountNo} onClick={save}><Save className="size-4" /> Save credentials</ActionButton>
                <ActionButton disabled={busy} onClick={resetFlow}><RotateCcw className="size-4" /> Start over</ActionButton>
              </div>
              {accountNo && <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-xs text-slate-400">Verified account <span className="font-medium text-slate-200">{accountNo}</span></div>}
            </div>
          )}

          {result && (
            <div className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 ${result.ok ? 'border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-200' : 'border-red-400/25 bg-red-400/[0.05] text-red-200'}`}>
              {result.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <XCircle className="mt-0.5 size-5 shrink-0" />}
              <span className="text-sm leading-5">{result.message}</span>
            </div>
          )}
          <p className="mt-4 text-[11px] leading-5 text-slate-500">JSON is parsed locally in the browser. Credentials are sent to the backend only when requesting SSI authentication, checking approval, testing, or saving.</p>
        </div>
      )}
    </section>
  );
}

function StepIndicator({ number, title, subtitle, active, done }: { number: string; title: string; subtitle: string; active: boolean; done: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold ${done ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : active ? 'border-sky-400 bg-sky-500 text-white' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>{done ? <Check className="size-4" /> : number}</span>
        <span className={`truncate text-xs font-semibold sm:text-sm ${active || done ? 'text-slate-100' : 'text-slate-400'}`}>{title}</span>
      </div>
      <p className="ml-10 mt-1 hidden truncate text-[11px] text-slate-500 sm:block">{subtitle}</p>
    </div>
  );
}

function CredentialField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[128px_minmax(0,1fr)]">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-200 sm:text-sm">{label}</span>
        {hint && <span className="mt-0.5 hidden text-[10px] leading-4 text-slate-500 sm:block">{hint}</span>}
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function CredentialInput({ value, onChange, onCopy, onToggleVisibility, type = 'text', visible = false, multiline = false }: { value: string; onChange: (value: string) => void; onCopy?: () => void; onToggleVisibility?: () => void; type?: string; visible?: boolean; multiline?: boolean }) {
  const common = 'w-full rounded-xl border border-white/10 bg-[#09171d] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400/60';
  const control = multiline ? `${common} min-h-20 resize-y py-2 leading-5` : `${common} h-12`;
  const input = multiline ? <textarea className={control} value={value} onChange={event => onChange(event.target.value)} placeholder="Paste value" autoComplete="off" /> : <input className={control} type={type} value={value} onChange={event => onChange(event.target.value)} placeholder="Enter value" autoComplete={type === 'password' ? 'new-password' : 'off'} />;
  return (
    <div className="relative">
      {input}
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {onToggleVisibility && <button type="button" onClick={onToggleVisibility} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.05] hover:text-slate-200" aria-label={visible ? 'Hide value' : 'Show value'}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>}
        {onCopy && <button type="button" onClick={onCopy} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.05] hover:text-slate-200" aria-label="Copy value"><Copy className="size-4" /></button>}
      </div>
    </div>
  );
}

function ActionButton({ disabled, onClick, children, primary = false }: { disabled?: boolean; onClick: () => void; children: ReactNode; primary?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition sm:text-sm ${primary ? 'border-sky-400/20 bg-sky-500 text-white shadow-[0_8px_22px_rgba(14,165,233,.16)] hover:bg-sky-400' : 'border-white/10 bg-[#09171d] text-slate-200 hover:border-white/15 hover:bg-white/[0.04]'} disabled:cursor-not-allowed disabled:opacity-45`}>{children}</button>
  );
}
