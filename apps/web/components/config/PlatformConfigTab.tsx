'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Clock3, FileJson, Eye, EyeOff, Loader2, RotateCcw, Save, ShieldCheck, Upload, Wifi, XCircle } from 'lucide-react';
import { platformApi } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

type SsiCredentials = { apiKey: string; apiSecret: string; privateKey: string };
type SsiAccount = { accountNo: string; accountType: string };
type SsiStep = 'credentials' | 'approval' | 'approved';
type Result = { ok: boolean; message: string } | null;

const emptySsi: SsiCredentials = { apiKey: '', apiSecret: '', privateKey: '' };
const APPROVAL_POLL_MS = 5000;

export default function PlatformConfigTab() {
  const [ssiEnv, setSsiEnv] = useState<'production' | 'sandbox'>('production');
  const [ssi, setSsi] = useState<SsiCredentials>(emptySsi);
  const [ssiAccountNo, setSsiAccountNo] = useState('');
  const [ssiAccounts, setSsiAccounts] = useState<SsiAccount[]>([]);
  const [ssiTransactionId, setSsiTransactionId] = useState('');
  const [ssiOtp, setSsiOtp] = useState('');
  const [ssiStep, setSsiStep] = useState<SsiStep>('credentials');
  const [ssiTested, setSsiTested] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [approvalChecking, setApprovalChecking] = useState(false);
  const [privateKeyVisible, setPrivateKeyVisible] = useState(false);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [jsonName, setJsonName] = useState('');
  const [result, setResult] = useState<Result>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void loadConfig(); }, []);

  useEffect(() => {
    if (ssiStep !== 'approval' || !ssiTransactionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (cancelled) return;
      const approved = await checkApproval(true);
      if (!cancelled && !approved) timer = setTimeout(poll, APPROVAL_POLL_MS);
    };
    timer = setTimeout(poll, APPROVAL_POLL_MS);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [ssiStep, ssiTransactionId]);

  function resetSsiFlow() {
    setSsiTransactionId('');
    setSsiOtp('');
    setSsiAccounts([]);
    setSsiAccountNo('');
    setSsiStep('credentials');
    setSsiTested(false);
    setApprovalChecking(false);
    setResult(null);
  }

  function updateSsi(key: keyof SsiCredentials, value: string) {
    setSsi(current => ({ ...current, [key]: value }));
    resetSsiFlow();
    setJsonName('');
  }

  async function loadConfig() {
    try {
      const response = await platformApi.credentials();
      const rows = response.data?.credentials ?? response.data ?? [];
      const configured = Array.isArray(rows) && rows.some((x: any) => x.provider === 'ssi' && (!x.environment || x.environment === ssiEnv));
      setStatus(s => ({ ...s, ssi: configured ? 'Configured' : 'Not configured' }));
    } catch {
      setStatus(s => ({ ...s, ssi: 'Unable to load' }));
    }
  }

  function errorMessage(error: any) {
    return error?.response?.data?.message ?? error?.response?.data?.error?.message ?? error?.message ?? 'Request failed';
  }

  async function importSsiJson(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      const sources: Record<string, unknown>[] = [];
      const collect = (value: unknown) => { if (value && typeof value === 'object' && !Array.isArray(value)) sources.push(value as Record<string, unknown>); };
      collect(parsed); collect((parsed as any)?.credentials); collect((parsed as any)?.ssi); collect((parsed as any)?.config);
      const normalized = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const pick = (...keys: string[]) => {
        const wanted = keys.map(normalized);
        for (const source of sources) for (const [key, value] of Object.entries(source)) if (value != null && wanted.includes(normalized(key))) return String(value);
        return '';
      };
      const imported: SsiCredentials = {
        apiKey: pick('apiKey', 'api_key', 'apikey', 'API Key'),
        apiSecret: pick('apiSecret', 'api_secret', 'secret', 'API Secret'),
        privateKey: pick('privateKey', 'private_key', 'privateKEY', 'Private Key'),
      };
      if (!imported.apiKey || !imported.apiSecret) throw new Error('JSON must contain API Key and API Secret');
      setSsi(imported);
      setSsiAccountNo(pick('accountNo', 'account_no', 'accountNumber', 'Account No'));
      setJsonName(file.name);
      resetSsiFlow();
      setStatus(s => ({ ...s, ssi: `JSON loaded — ${file.name}` }));
    } catch (error) {
      setResult({ ok: false, message: errorMessage(error) });
      setJsonName('');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function requestSsiApproval() {
    if (!ssi.apiKey.trim() || !ssi.apiSecret.trim() || !ssi.privateKey.trim()) {
      setResult({ ok: false, message: 'API Key, API Secret and Private Key are required.' });
      return;
    }
    setBusy('ssi'); setResult(null); setSsiTested(false);
    try {
      const response = await platformApi.ssiOtp({ environment: ssiEnv, credentials: ssi });
      const transactionId = response.data?.data?.transactionId ?? response.data?.transactionId ?? '';
      if (!transactionId) throw new Error('SSI did not return a transaction ID.');
      setSsiTransactionId(String(transactionId));
      setSsiStep('approval');
      setResult({ ok: true, message: 'Login request sent to SSI. Approve it in SSI iBoard/app.' });
      setStatus(s => ({ ...s, ssi: 'Waiting for SSI approval' }));
    } catch (error) {
      setResult({ ok: false, message: `Unable to request SSI approval: ${errorMessage(error)}` });
      setStatus(s => ({ ...s, ssi: 'Authentication request failed' }));
    } finally { setBusy(null); }
  }

  async function checkApproval(silent = false) {
    if (!ssiTransactionId && !ssiOtp.trim()) return false;
    setApprovalChecking(true);
    if (!silent) setResult(null);
    try {
      const response = await platformApi.ssiApprove({ environment: ssiEnv, credentials: ssi, transactionId: ssiTransactionId.trim() || undefined, otp: ssiOtp.trim() || undefined });
      const data = response.data;
      if (!data?.ok) {
        if (!silent) setResult({ ok: false, message: data?.error?.message ?? 'SSI approval is still pending.' });
        return false;
      }
      setSsiStep('approved');
      setResult({ ok: true, message: 'SSI approval confirmed. You can now test the connection.' });
      setStatus(s => ({ ...s, ssi: 'SSI approval confirmed' }));
      return true;
    } catch (error) {
      if (!silent) setResult({ ok: false, message: `Waiting for SSI approval: ${errorMessage(error)}` });
      return false;
    } finally { setApprovalChecking(false); }
  }

  async function testSsi() {
    if (ssiStep !== 'approved') {
      setResult({ ok: false, message: 'Complete SSI approval before testing the connection.' });
      return;
    }
    setBusy('ssi'); setSsiTested(false); setResult(null);
    try {
      const response = await platformApi.ssiTest({ environment: ssiEnv, credentials: ssi });
      const data = response.data;
      if (!data?.ok) throw new Error(data?.error?.message ?? 'SSI connection failed');
      const accounts: SsiAccount[] = data.data?.accounts ?? [];
      setSsiAccounts(accounts);
      setSsiAccountNo(current => current && accounts.some(a => a.accountNo === current) ? current : accounts[0]?.accountNo ?? '');
      setSsiTested(true);
      setResult({ ok: true, message: accounts.length ? `SSI connection verified — ${accounts.length} account(s) loaded.` : 'SSI connection verified.' });
      setStatus(s => ({ ...s, ssi: 'Connection verified' }));
    } catch (error) {
      setResult({ ok: false, message: errorMessage(error) });
      setStatus(s => ({ ...s, ssi: 'Connection test failed' }));
    } finally { setBusy(null); }
  }

  async function saveSsi() {
    if (!ssiTested || !ssiAccountNo) {
      setResult({ ok: false, message: 'Test Connection successfully and select an account before saving.' });
      return;
    }
    setBusy('ssi');
    try {
      const response = await platformApi.ssiSaveTested({ environment: ssiEnv, credentials: ssi, accountNo: ssiAccountNo, transactionId: ssiTransactionId || undefined, otp: ssiOtp.trim() || undefined });
      if (!response.data?.ok) throw new Error(response.data?.error?.message ?? 'Unable to save SSI credentials');
      setResult({ ok: true, message: 'SSI credentials and verified session saved securely.' });
      setStatus(s => ({ ...s, ssi: 'Configured' }));
    } catch (error) { setResult({ ok: false, message: errorMessage(error) }); }
    finally { setBusy(null); }
  }

  return <div className="space-y-4">
    <div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#887b91]">Platform configuration</p><h2 className="mt-1 text-xl font-semibold">Connections & environments</h2><p className="mt-1 text-sm text-zinc-400">Configure credentials, approve the SSI login, then test and save the verified connection.</p></div>
    <Tabs defaultValue="ssi" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="ssi">SSI FastConnect</TabsTrigger><TabsTrigger value="binance">Binance Futures</TabsTrigger><TabsTrigger value="fastapi">FastAPI</TabsTrigger></TabsList>
      <TabsContent value="ssi">
        <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>SSI FastConnect</CardTitle><CardDescription>Credentials are parsed locally. SSI approval is required before connection testing.</CardDescription></div><StatusBadge value={status.ssi}/></div></CardHeader><CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2"><Step number="1" title="Credentials" active={ssiStep === 'credentials'} done={ssiStep !== 'credentials'}/><Step number="2" title="SSI approval" active={ssiStep !== 'credentials'} done={ssiStep === 'approved'}/></div>

          {ssiStep === 'credentials' && <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={e => { const file = e.target.files?.[0]; if (file) void importSsiJson(file); }}/><Button type="button" variant="outline" disabled={!!busy} onClick={() => fileRef.current?.click()}><Upload className="size-4"/>Upload JSON</Button>{jsonName && <span className="min-w-0 truncate text-xs text-zinc-400"><FileJson className="mr-1 inline size-3.5"/>{jsonName}</span>}</div>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Environment"><select value={ssiEnv} onChange={e => { setSsiEnv(e.target.value as 'production' | 'sandbox'); resetSsiFlow(); }} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60"><option value="production">Production</option><option value="sandbox">Sandbox</option></select></Field><div/></div>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="API Key"><Input value={ssi.apiKey} onChange={e => updateSsi('apiKey', e.target.value)} type="password" autoComplete="new-password"/></Field><Field label="API Secret"><Input value={ssi.apiSecret} onChange={e => updateSsi('apiSecret', e.target.value)} type="password" autoComplete="new-password"/></Field><Field label="Private Key"><div className="relative"><textarea value={ssi.privateKey} onChange={e => updateSsi('privateKey', e.target.value)} rows={5} className={`w-full rounded-xl border border-white/10 bg-black/20 p-3 pr-12 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60 ${privateKeyVisible ? '' : 'tracking-[.18em]'}`} autoComplete="off" style={privateKeyVisible ? undefined : { WebkitTextSecurity: 'disc' } as any}/><button type="button" aria-label={privateKeyVisible ? 'Hide private key' : 'Show private key'} onClick={() => setPrivateKeyVisible(v => !v)} className="absolute right-2 top-2 rounded-lg p-2 text-zinc-400 hover:text-white">{privateKeyVisible ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button></div></Field></div>
            <Button type="button" disabled={!!busy} onClick={() => void requestSsiApproval()}>{busy ? <Loader2 className="size-4 animate-spin"/> : <ShieldCheck className="size-4"/>}Request SSI approval</Button>
          </div>}

          {ssiStep === 'approval' && <div className="space-y-4">
            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4"><div className="flex items-start gap-3">{approvalChecking ? <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-amber-200"/> : <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-200"/>}<div className="min-w-0"><p className="font-semibold text-amber-100">Waiting for SSI approval</p><p className="mt-1 text-sm leading-5 text-amber-100/70">Open SSI iBoard/app and approve the login request. TCE checks the approval automatically every 5 seconds.</p><p className="mt-3 break-all text-[11px] text-amber-100/50">Transaction ID: {ssiTransactionId}</p></div></div></div>
            <Field label="OTP (only if SSI asks for OTP)"><Input value={ssiOtp} onChange={e => setSsiOtp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter SSI OTP"/></Field>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={approvalChecking || !!busy} onClick={() => void checkApproval(false)}>{approvalChecking ? <Loader2 className="size-4 animate-spin"/> : <ShieldCheck className="size-4"/>}Check approval</Button><Button type="button" variant="outline" disabled={!!busy} onClick={resetSsiFlow}><RotateCcw className="size-4"/>Start over</Button></div>
          </div>}

          {ssiStep === 'approved' && <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-200"/><div><p className="font-semibold text-emerald-100">SSI approval confirmed</p><p className="mt-1 text-sm leading-5 text-emerald-100/70">SSI accepted the login request. Test Connection is now enabled.</p></div></div></div>
            <div className="flex flex-wrap gap-2"><Button type="button" disabled={!!busy} onClick={() => void testSsi()}>{busy ? <Loader2 className="size-4 animate-spin"/> : <Wifi className="size-4"/>}Test Connection</Button><Button type="button" variant="outline" disabled={!!busy || !ssiTested || !ssiAccountNo} onClick={() => void saveSsi()}><Save className="size-4"/>Save</Button><Button type="button" variant="outline" disabled={!!busy} onClick={resetSsiFlow}><RotateCcw className="size-4"/>Start over</Button></div>
            {ssiAccounts.length > 0 && <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-zinc-400">Account</span><select value={ssiAccountNo} onChange={e => setSsiAccountNo(e.target.value)} className="h-10 min-w-48 rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none"><option value="">Select account</option>{ssiAccounts.map(a => <option key={a.accountNo} value={a.accountNo}>{a.accountNo} · {a.accountType}</option>)}</select></div></div>}
          </div>}

          {result && <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${result.ok ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200' : 'border-red-300/15 bg-red-300/[0.05] text-red-200'}`}>{result.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0"/> : <XCircle className="mt-0.5 size-4 shrink-0"/>}<span>{result.message}</span></div>}
          <p className="text-[11px] leading-5 text-[#75697d]">JSON is parsed locally. Credentials are sent to the backend only for SSI authentication, approval verification, connection testing, and saving.</p>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="binance"><BinanceTab busy={busy} setBusy={setBusy}/></TabsContent>
      <TabsContent value="fastapi"><FastApiTab busy={busy} setBusy={setBusy}/></TabsContent>
    </Tabs>
  </div>;
}

function BinanceTab({ busy, setBusy }: { busy: string | null; setBusy: (value: string | null) => void }) {
  const [env, setEnv] = useState<'production' | 'testnet'>('testnet');
  const [credentials, setCredentials] = useState({ apiKey: '', apiSecret: '' });
  const [status, setStatus] = useState('');
  const run = async (action: () => Promise<any>, success: string) => { setBusy('binance'); try { await action(); setStatus(success); } catch (e: any) { setStatus(e?.response?.data?.message ?? e?.message ?? 'Request failed'); } finally { setBusy(null); } };
  return <Card><CardHeader><CardTitle>Binance Futures</CardTitle><CardDescription>Environment is shared by save and connection test.</CardDescription></CardHeader><CardContent className="space-y-4"><Field label="Environment"><select value={env} onChange={e => setEnv(e.target.value as 'production' | 'testnet')} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white"><option value="testnet">Testnet</option><option value="production">Production</option></select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="API Key"><Input value={credentials.apiKey} onChange={e => setCredentials({ ...credentials, apiKey: e.target.value })} type="password" autoComplete="new-password"/></Field><Field label="API Secret"><Input value={credentials.apiSecret} onChange={e => setCredentials({ ...credentials, apiSecret: e.target.value })} type="password" autoComplete="new-password"/></Field></div><div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => void run(() => platformApi.save('binance', env, credentials), 'Saved')}>Save</Button><Button variant="outline" disabled={!!busy} onClick={() => void run(() => platformApi.binanceTest(env), 'Connection OK')}><Wifi className="size-4"/>Test connection</Button></div>{status && <p className="text-sm text-zinc-300">{status}</p>}</CardContent></Card>;
}

function FastApiTab({ busy, setBusy }: { busy: string | null; setBusy: (value: string | null) => void }) {
  const [config, setConfig] = useState({ baseUrl: '', healthPath: '/health' });
  const [status, setStatus] = useState('');
  const run = async () => { setBusy('fastapi'); try { await platformApi.saveFastApi(config); setStatus('Saved'); } catch (e: any) { setStatus(e?.response?.data?.message ?? e?.message ?? 'Request failed'); } finally { setBusy(null); } };
  return <Card><CardHeader><CardTitle>FastAPI</CardTitle><CardDescription>Backend service connection metadata.</CardDescription></CardHeader><CardContent className="space-y-4"><Field label="Base URL"><Input value={config.baseUrl} onChange={e => setConfig({ ...config, baseUrl: e.target.value })} placeholder="https://api.example.com"/></Field><Field label="Health path"><Input value={config.healthPath} onChange={e => setConfig({ ...config, healthPath: e.target.value })} placeholder="/health"/></Field><Button disabled={!!busy} onClick={() => void run()}><Save className="size-4"/>Save configuration</Button>{status && <p className="text-sm text-zinc-300">{status}</p>}</CardContent></Card>;
}

function Step({ number, title, active, done }: { number: string; title: string; active: boolean; done: boolean }) { return <div className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 ${done ? 'border-emerald-300/15 bg-emerald-300/[0.05]' : active ? 'border-violet-300/20 bg-violet-300/[0.06]' : 'border-white/10'}`}>{done ? <CheckCircle2 className="size-4 text-emerald-200"/> : <span className="grid size-5 place-items-center rounded-full bg-violet-300/10 text-[10px] font-bold">{number}</span>}<span className="text-xs font-semibold">{title}</span></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5"><span className="block text-xs font-medium text-zinc-300">{label}</span>{children}</label>; }
function StatusBadge({ value }: { value?: string }) { if (!value) return null; const ok = /configured|saved|ok|verified|confirmed/i.test(value); return <span className={`rounded-full border px-2.5 py-1 text-[11px] ${ok ? 'border-emerald-400/20 text-emerald-300' : 'border-white/10 text-zinc-400'}`}>{value}</span>; }
