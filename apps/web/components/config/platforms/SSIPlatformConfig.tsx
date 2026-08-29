'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Clock3, FileJson, Eye, EyeOff, Loader2, RotateCcw, Save, ShieldCheck, Upload, Wifi, XCircle } from 'lucide-react';
import { platformApi } from '../../../lib/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import type { PlatformConfigProps } from './types';

type Credentials = { clientId: string; apiKey: string; apiSecret: string; privateKey: string };
type Account = { accountNo: string; accountType: string };
type Step = 'credentials' | 'approval' | 'approved';
type Result = { ok: boolean; message: string } | null;

const EMPTY: Credentials = { clientId: '', apiKey: '', apiSecret: '', privateKey: '' };

export default function SSIPlatformConfig({ busy, setBusy }: PlatformConfigProps) {
  const [env] = useState('production');
  const [credentials, setCredentials] = useState<Credentials>(EMPTY);
  const [accountNo, setAccountNo] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactionId, setTransactionId] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('credentials');
  const [tested, setTested] = useState(false);
  const [approvalChecking, setApprovalChecking] = useState(false);
  const [privateKeyVisible, setPrivateKeyVisible] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const resetFlow = () => {
    setTransactionId(''); setOtp(''); setAccountNo(''); setAccounts([]); setStep('credentials'); setTested(false); setResult(null);
  };
  const update = (key: keyof Credentials, value: string) => { setCredentials(c => ({ ...c, [key]: value })); resetFlow(); setFileName(''); };
  const errorMessage = (error: any) => error?.response?.data?.message ?? error?.response?.data?.error?.message ?? error?.message ?? 'Request failed';

  useEffect(() => {
    if (step !== 'approval' || !transactionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => { if (cancelled) return; const ok = await checkApproval(true); if (!cancelled && !ok) timer = setTimeout(poll, 5000); };
    timer = setTimeout(poll, 5000);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [step, transactionId]);

  async function checkApproval(silent = false) {
    if (!transactionId && !otp.trim()) return false;
    setApprovalChecking(true);
    try {
      const r = await platformApi.ssiApprove({ environment: env, credentials, transactionId: transactionId || undefined, otp: otp.trim() || undefined });
      if (!r.data?.ok) { if (!silent) setResult({ ok: false, message: r.data?.error?.message ?? 'SSI approval is still pending.' }); return false; }
      setStep('approved'); setResult({ ok: true, message: 'SSI approval confirmed. You can now test the connection.' }); return true;
    } catch (e) { if (!silent) setResult({ ok: false, message: `Waiting for SSI approval: ${errorMessage(e)}` }); return false; }
    finally { setApprovalChecking(false); }
  }

  async function uploadJson(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const sources = [parsed, parsed?.credentials, parsed?.ssi, parsed?.config].filter(v => v && typeof v === 'object' && !Array.isArray(v));
      const pick = (...keys: string[]) => {
        for (const source of sources) for (const key of keys) if (source[key] != null && String(source[key]).trim()) return String(source[key]);
        return '';
      };
      const next: Credentials = { clientId: pick('clientId', 'client_id', 'clientID'), apiKey: pick('apiKey', 'api_key'), apiSecret: pick('apiSecret', 'api_secret', 'secret'), privateKey: pick('privateKey', 'private_key') };
      if (!next.clientId || !next.apiKey || !next.apiSecret || !next.privateKey) throw new Error('JSON must contain Client ID, API Key, API Secret and Private Key');
      setCredentials(next); setFileName(file.name); resetFlow(); setResult({ ok: true, message: `Loaded SSI credentials from ${file.name}.` });
    } catch (e) { setResult({ ok: false, message: errorMessage(e) }); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  async function requestApproval() {
    if (!credentials.clientId.trim() || !credentials.apiKey.trim() || !credentials.apiSecret.trim() || !credentials.privateKey.trim()) { setResult({ ok: false, message: 'Client ID, API Key, API Secret and Private Key are required.' }); return; }
    setBusy('ssi'); setResult(null); setTested(false);
    try {
      const r = await platformApi.ssiOtp({ environment: env, credentials });
      const tx = r.data?.data?.transactionId ?? r.data?.transactionId ?? '';
      if (!tx) throw new Error('SSI did not return a transaction ID.');
      setTransactionId(String(tx)); setStep('approval'); setResult({ ok: true, message: 'SSI login request sent. Approve it in SSI iBoard/app.' });
    } catch (e) { setResult({ ok: false, message: `Unable to request SSI approval: ${errorMessage(e)}` }); }
    finally { setBusy(null); }
  }

  async function testConnection() {
    if (step !== 'approved') { setResult({ ok: false, message: 'Complete SSI approval before testing the connection.' }); return; }
    setBusy('ssi'); setResult(null); setTested(false);
    try {
      const r = await platformApi.ssiTest({ environment: env, credentials });
      if (!r.data?.ok) throw new Error(r.data?.error?.message ?? 'SSI connection failed');
      const list: Account[] = Array.isArray(r.data?.data?.accounts) ? r.data.data.accounts : [];
      setAccounts(list); setAccountNo(current => current && list.some(a => a.accountNo === current) ? current : (list[0]?.accountNo ?? r.data?.data?.accountNo ?? '')); setTested(true);
      setResult({ ok: true, message: list.length ? `SSI connection verified — ${list.length} account(s) loaded.` : 'SSI connection verified.' });
    } catch (e) { setResult({ ok: false, message: errorMessage(e) }); }
    finally { setBusy(null); }
  }

  async function save() {
    if (!tested || !accountNo) { setResult({ ok: false, message: 'Test Connection successfully and select an account before saving.' }); return; }
    setBusy('ssi');
    try {
      const r = await platformApi.ssiSaveTested({ environment: env, credentials, accountNo, transactionId: transactionId || undefined, otp: otp.trim() || undefined });
      if (!r.data?.ok) throw new Error(r.data?.error?.message ?? 'SSI save failed');
      setResult({ ok: true, message: 'SSI credentials and Client ID saved securely.' });
    } catch (e) { setResult({ ok: false, message: errorMessage(e) }); }
    finally { setBusy(null); }
  }

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2"><Step title="Credentials" number="1" active={step === 'credentials'} done={step !== 'credentials'} /><Step title="SSI approval" number="2" active={step !== 'credentials'} done={step === 'approved'} /></div>
    {step === 'credentials' && <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e => void uploadJson(e.target.files?.[0])}/><Button variant="outline" disabled={!!busy} onClick={() => fileRef.current?.click()}><Upload className="size-4"/> Upload JSON</Button>{fileName && <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/10 px-3 text-xs text-emerald-200"><FileJson className="size-4"/>{fileName}</span>}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client ID"><Input value={credentials.clientId} onChange={e => update('clientId', e.target.value)} placeholder="Client ID" autoComplete="off"/></Field>
        <Field label="API Key"><Input value={credentials.apiKey} onChange={e => update('apiKey', e.target.value)} placeholder="API Key" autoComplete="off"/></Field>
        <Field label="API Secret"><Input value={credentials.apiSecret} onChange={e => update('apiSecret', e.target.value)} type="password" autoComplete="new-password"/></Field>
        <Field label="Private Key"><div className="relative"><textarea value={credentials.privateKey} onChange={e => update('privateKey', e.target.value)} rows={5} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 pr-12 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60"/><button type="button" onClick={() => setPrivateKeyVisible(v => !v)} className="absolute right-2 top-2 rounded-lg p-2 text-zinc-400 hover:text-white" aria-label={privateKeyVisible ? 'Hide private key' : 'Show private key'}>{privateKeyVisible ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button></div></Field>
      </div>
      <Button disabled={!!busy} onClick={() => void requestApproval()}>{busy ? <Loader2 className="size-4 animate-spin"/> : <ShieldCheck className="size-4"/>} Request SSI approval</Button>
    </div>}
    {step === 'approval' && <div className="space-y-4"><div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4 flex items-start gap-3">{approvalChecking ? <Loader2 className="size-5 animate-spin text-amber-200"/> : <Clock3 className="size-5 text-amber-200"/>}<div><p className="font-semibold text-amber-100">Waiting for SSI approval</p><p className="mt-1 text-sm text-amber-100/70">Approve the login in SSI iBoard/app.</p><p className="mt-2 text-[11px] text-amber-100/50 break-all">Transaction ID: {transactionId}</p></div></div><Field label="OTP (if required)"><Input value={otp} onChange={e => setOtp(e.target.value)} inputMode="numeric" autoComplete="one-time-code"/></Field><div className="flex gap-2"><Button variant="outline" disabled={approvalChecking || !!busy} onClick={() => void checkApproval(false)}><ShieldCheck className="size-4"/> Check approval</Button><Button variant="outline" onClick={resetFlow}><RotateCcw className="size-4"/> Start over</Button></div></div>}
    {step === 'approved' && <div className="space-y-4"><div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4 flex items-center gap-3"><CheckCircle2 className="size-5 text-emerald-200"/><div><p className="font-semibold text-emerald-100">SSI approval confirmed</p><p className="text-sm text-emerald-100/70">Test Connection is now enabled.</p></div></div><div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => void testConnection()}>{busy ? <Loader2 className="size-4 animate-spin"/> : <Wifi className="size-4"/>} Test Connection</Button><Button variant="outline" disabled={!!busy || !tested || !accountNo} onClick={() => void save()}><Save className="size-4"/> Save</Button></div>{accounts.length > 0 && <Field label="SSI Account"><select value={accountNo} onChange={e => setAccountNo(e.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white"><option value="">Select account</option>{accounts.map(a => <option key={a.accountNo} value={a.accountNo}>{a.accountNo} · {a.accountType}</option>)}</select></Field>}</div>}
    {result && <div className={`rounded-xl border px-3 py-2.5 text-sm ${result.ok ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200' : 'border-red-300/15 bg-red-300/[0.05] text-red-200'}`}>{result.message}</div>}
  </div>;
}
function Step({ title, number, active, done }: { title: string; number: string; active: boolean; done: boolean }) { return <div className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 ${done ? 'border-emerald-300/15 bg-emerald-300/[0.05]' : active ? 'border-violet-300/20 bg-violet-300/[0.06]' : 'border-white/10'}`}>{done ? <CheckCircle2 className="size-4 text-emerald-200"/> : <span className="grid size-5 place-items-center rounded-full bg-violet-300/10 text-[10px] font-bold">{number}</span>}<span className="text-xs font-semibold">{title}</span></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5"><span className="block text-xs font-medium text-zinc-300">{label}</span>{children}</label>; }
