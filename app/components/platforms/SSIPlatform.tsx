'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  FileJson,
  KeyRound,
  Loader2,
  ShieldCheck,
  Upload,
  XCircle,
  Clock3,
  RotateCcw,
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
  const [open, setOpen] = useState(false);
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
        message:
          'Client ID, API Key, API Secret and Private Key are required before requesting SSI approval.',
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
      if (!nextTransactionId)
        throw new Error('SSI did not return a transaction ID. Please try again.');
      setTransactionId(nextTransactionId);
      setOtp('');
      setAuthStep('approval');
      setResult({
        ok: true,
        message:
          'SSI login request sent. Approve it in SSI iBoard/app. We will check the approval status automatically.',
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
        if (!silent)
          setResult({
            ok: false,
            message: data?.error?.message ?? 'SSI approval is still pending.',
          });
        return false;
      }
      setAuthStep('approved');
      setResult({ ok: true, message: 'SSI approval confirmed. You can now run Test Connection.' });
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
      const ok = Boolean(data?.ok);
      if (!ok) throw new Error(data?.error?.message ?? 'SSI connection failed');
      const accounts = Array.isArray(data?.data?.accounts) ? data.data.accounts : [];
      const selectedAccount = accounts[0]?.accountNo ?? data?.data?.accountNo ?? '';
      setAccountNo(String(selectedAccount));
      setTested(true);
      setResult({
        ok: true,
        message: accounts.length
          ? `SSI connection verified — ${accounts.length} account(s) loaded.`
          : 'SSI connection verified.',
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

  const save = async () => {
    if (!tested || !accountNo) {
      setResult({
        ok: false,
        message: 'Test Connection must succeed and return an SSI account before saving.',
      });
      return;
    }
    setBusy(true);
    try {
      const response = await platformApi.ssiSaveTested({
        environment: ENVIRONMENT,
        credentials,
        accountNo,
        otp: otp.trim() || undefined,
        transactionId: transactionId.trim() || undefined,
      });
      const data = response.data;
      if (!data?.ok) {
        setResult({ ok: false, message: data?.error?.message ?? 'SSI save failed' });
        return;
      }
      setResult({
        ok: true,
        message: 'SSI credentials, Client ID and verified session saved securely.',
      });
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
    <section className="mb-5 overflow-hidden rounded-[22px] border border-violet-200/[0.09] bg-[#150d1d] shadow-[0_18px_50px_rgba(0,0,0,.18)]">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex min-h-16 w-full items-center justify-between gap-4 px-5 text-left"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-200">
            <KeyRound className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">SSI FastConnect</p>
            <p className="mt-0.5 truncate text-xs text-[#81748a]">Production</p>
          </div>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-[#81748a] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-violet-200/[0.07] px-5 pb-5 pt-4">
          <div className="mb-5 grid grid-cols-2 gap-2">
            <StepIndicator
              number="1"
              title="Credentials"
              active={authStep === 'credentials'}
              done={authStep !== 'credentials'}
            />
            <StepIndicator
              number="2"
              title="SSI approval"
              active={authStep !== 'credentials'}
              done={authStep === 'approved'}
            />
          </div>
          {authStep === 'credentials' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={event => void uploadJson(event.target.files?.[0])}
                />
                <ActionButton disabled={busy} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4" /> Upload JSON
                </ActionButton>
                {fileName && (
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] px-3 text-xs text-emerald-200">
                    <FileJson className="size-4" />
                    {fileName}
                  </span>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Client ID">
                  <input
                    className="input"
                    value={credentials.clientId}
                    onChange={event => updateCredential('clientId', event.target.value)}
                    placeholder="Client ID"
                    autoComplete="off"
                  />
                </Field>
                <Field label="API Key">
                  <input
                    className="input"
                    value={credentials.apiKey}
                    onChange={event => updateCredential('apiKey', event.target.value)}
                    placeholder="API Key"
                    autoComplete="off"
                  />
                </Field>
                <Field label="API Secret">
                  <input
                    className="input"
                    type="password"
                    value={credentials.apiSecret}
                    onChange={event => updateCredential('apiSecret', event.target.value)}
                    placeholder="API Secret"
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Private Key">
                  <textarea
                    className="input min-h-24 resize-y py-2"
                    value={credentials.privateKey}
                    onChange={event => updateCredential('privateKey', event.target.value)}
                    placeholder="Private Key"
                    autoComplete="off"
                  />
                </Field>
              </div>
              <ActionButton disabled={busy} onClick={() => void requestOtp()}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}{' '}
                Request SSI approval
              </ActionButton>
            </div>
          )}
          {authStep === 'approval' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4">
                <div className="flex items-start gap-3">
                  {approvalChecking ? (
                    <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-amber-200" />
                  ) : (
                    <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-amber-100">Waiting for SSI approval</p>
                    <p className="mt-1 text-sm leading-5 text-amber-100/70">
                      Open SSI iBoard/app and approve the login request. This screen checks the
                      approval automatically every 5 seconds.
                    </p>
                    <p className="mt-3 break-all text-[11px] text-amber-100/50">
                      Transaction ID: {transactionId}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  disabled={approvalChecking || busy}
                  onClick={() => void checkApproval(false)}
                >
                  {approvalChecking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}{' '}
                  Check approval
                </ActionButton>
                <ActionButton disabled={busy} onClick={resetFlow}>
                  <RotateCcw className="size-4" /> Start over
                </ActionButton>
              </div>
              <Field label="OTP (if SSI asks for OTP)">
                <input
                  className="input"
                  inputMode="numeric"
                  value={otp}
                  onChange={event => {
                    setOtp(event.target.value);
                    setResult(null);
                  }}
                  placeholder="Enter OTP from SSI"
                  autoComplete="one-time-code"
                />
              </Field>
            </div>
          )}
          {authStep === 'approved' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-200" />
                  <div>
                    <p className="font-semibold text-emerald-100">SSI approval confirmed</p>
                    <p className="mt-1 text-sm leading-5 text-emerald-100/70">
                      The SSI authentication request was approved. Test Connection is now enabled.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton disabled={busy} onClick={() => void testConnection()}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}{' '}
                  Test Connection
                </ActionButton>
                <ActionButton disabled={busy || !tested || !accountNo} onClick={save}>
                  Save
                </ActionButton>
                <ActionButton disabled={busy} onClick={resetFlow}>
                  <RotateCcw className="size-4" /> Start over
                </ActionButton>
              </div>
              {accountNo && (
                <p className="text-xs text-zinc-400">Selected SSI account: {accountNo}</p>
              )}
            </div>
          )}
          {result && (
            <div
              className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${result.ok ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200' : 'border-red-300/15 bg-red-300/[0.05] text-red-200'}`}
            >
              {result.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}
          <p className="mt-3 text-[11px] leading-5 text-[#75697d]">
            JSON is parsed locally in the browser. Credentials are sent to the backend only when
            requesting SSI authentication, checking approval, testing, or saving.
          </p>
        </div>
      )}
    </section>
  );
}

function StepIndicator({
  number,
  title,
  active,
  done,
}: {
  number: string;
  title: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 ${done ? 'border-emerald-300/15 bg-emerald-300/[0.05]' : active ? 'border-violet-300/20 bg-violet-300/[0.06]' : 'border-violet-200/[0.08] bg-[#1b1123]'}`}
    >
      {done ? (
        <CheckCircle2 className="size-4 text-emerald-200" />
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-violet-300/10 text-[10px] font-bold text-violet-100">
          {number}
        </span>
      )}
      <span className="text-xs font-semibold">{title}</span>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.1em] text-[#81748a]">
        {label}
      </span>
      {children}
    </label>
  );
}
function ActionButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-200/10 bg-[#1b1123] px-3.5 text-xs font-semibold text-[#ddd2e5] transition hover:bg-[#23152d] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}
