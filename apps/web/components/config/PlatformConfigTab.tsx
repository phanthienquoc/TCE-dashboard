'use client';

import { useEffect, useRef, useState } from 'react';
import { FileJson, Pencil, Save, Upload, Wifi, X } from 'lucide-react';
import { platformApi } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

type SsiCredentials = { apiKey: string; apiSecret: string; privateKey: string };
type SsiAccount = { accountNo: string; accountType: string };
const emptySsi: SsiCredentials = { apiKey: '', apiSecret: '', privateKey: '' };

export default function PlatformConfigTab() {
  const [ssiEnv, setSsiEnv] = useState<'production' | 'sandbox'>('production');
  const [ssi, setSsi] = useState<SsiCredentials>(emptySsi);
  const [ssiAccountNo, setSsiAccountNo] = useState('');
  const [ssiAccounts, setSsiAccounts] = useState<SsiAccount[]>([]);
  const [ssiOtp, setSsiOtp] = useState('');
  const [ssiTransactionId, setSsiTransactionId] = useState('');
  const [ssiTested, setSsiTested] = useState(false);
  const [ssiTradingVerified, setSsiTradingVerified] = useState(false);
  const [ssiEditing, setSsiEditing] = useState(false);
  const [binanceEnv, setBinanceEnv] = useState<'production' | 'testnet'>('testnet');
  const [binance, setBinance] = useState({ apiKey: '', apiSecret: '' });
  const [binanceEditing, setBinanceEditing] = useState(false);
  const [fastapi, setFastapi] = useState({ baseUrl: '', healthPath: '/health' });
  const [status, setStatus] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [jsonName, setJsonName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const ssiConfigured = status.ssi === 'Configured';
  const binanceConfigured = status.binance === 'Configured';

  useEffect(() => { void loadConfig(); }, []);
  useEffect(() => { resetSsiTest(); }, [ssiEnv]);
  useEffect(() => { setSsiEditing(!ssiConfigured); }, [ssiConfigured]);
  useEffect(() => { setBinanceEditing(!binanceConfigured); }, [binanceConfigured]);

  function resetSsiTest() {
    setSsiTested(false);
    setSsiTradingVerified(false);
    setSsiAccounts([]);
    setSsiAccountNo('');
    setSsiOtp('');
    setSsiTransactionId('');
  }

  async function loadConfig() {
    try {
      const [credentials, fast] = await Promise.all([platformApi.credentials(), platformApi.fastApiConfig()]);
      const rows = credentials.data?.credentials ?? credentials.data ?? [];
      const has = (provider: string, environment: string) =>
        Array.isArray(rows)
          ? rows.some((x: any) => x.provider === provider && (!x.environment || x.environment === environment))
          : Boolean(rows?.[provider]);
      setStatus(s => ({ ...s, ssi: has('ssi', ssiEnv) ? 'Configured' : 'Not configured', binance: has('binance', binanceEnv) ? 'Configured' : 'Not configured' }));
      const cfg = fast.data?.config ?? fast.data ?? {};
      setFastapi({ baseUrl: cfg.baseUrl ?? '', healthPath: cfg.healthPath ?? '/health' });
    } catch {
      setStatus(s => ({ ...s, ssi: 'Unable to load', binance: 'Unable to load' }));
    }
  }

  async function importSsiJson(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      const sources: Record<string, unknown>[] = [];
      const collect = (value: unknown) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) sources.push(value as Record<string, unknown>);
      };
      collect(parsed);
      collect(parsed?.credentials);
      collect(parsed?.ssi);
      collect(parsed?.config);
      const normalized = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const pick = (...keys: string[]) => {
        const wanted = keys.map(normalized);
        for (const source of sources) {
          for (const [key, value] of Object.entries(source)) {
            if (value !== undefined && value !== null && wanted.includes(normalized(key))) return String(value);
          }
        }
        return '';
      };
      const imported: SsiCredentials = {
        apiKey: pick('apiKey', 'api_key', 'apikey', 'ApiKey', 'API Key'),
        apiSecret: pick('apiSecret', 'api_secret', 'secret', 'ApiSecret', 'API Secret'),
        privateKey: pick('privateKey', 'private_key', 'privateKEY', 'PrivateKey', 'Private Key'),
      };
      if (!imported.apiKey || !imported.apiSecret) throw new Error('JSON must contain API Key and API Secret');
      setSsi(imported);
      setSsiAccountNo(pick('accountNo', 'account_no', 'accountNumber', 'Account No'));
      setJsonName(file.name);
      resetSsiTest();
      setSsiEditing(true);
      setStatus(s => ({ ...s, ssi: 'JSON loaded — test connection' }));
    } catch (e: any) {
      setStatus(s => ({ ...s, ssi: `JSON import failed: ${e?.message ?? 'Invalid JSON'}` }));
      setJsonName('');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function readError(error: any) {
    const payload = error?.response?.data;
    return payload?.message ?? payload?.error?.message ?? payload?.msg ?? error?.message ?? 'Request failed';
  }

  async function run(key: string, action: () => Promise<any>, success: string) {
    setBusy(key);
    setStatus(s => ({ ...s, [key]: 'Working…' }));
    try {
      await action();
      setStatus(s => ({ ...s, [key]: success }));
    } catch (e: any) {
      setStatus(s => ({ ...s, [key]: readError(e) }));
    } finally {
      setBusy(null);
    }
  }

  async function testSsi(withTradingAuth = false) {
    if (!ssiEditing && ssiConfigured) {
      await run('ssi', async () => {
        const response = await platformApi.ssiCurrent({ environment: ssiEnv });
        const result = response.data;
        if (result?.ok === false) throw new Error(result?.error?.message ?? 'SSI connection failed');
      }, 'Connection OK');
      return;
    }
    if (!ssi.apiKey || !ssi.apiSecret) {
      setStatus(s => ({ ...s, ssi: 'API Key and API Secret are required' }));
      return;
    }
    if (withTradingAuth && !ssiOtp && !ssiTransactionId) {
      setStatus(s => ({ ...s, ssi: 'Enter OTP first' }));
      return;
    }
    setBusy('ssi');
    setStatus(s => ({ ...s, ssi: withTradingAuth ? 'Verifying trading access…' : 'Testing API credentials…' }));
    try {
      const response = await platformApi.ssiTest({ environment: ssiEnv, credentials: ssi, otp: withTradingAuth ? (ssiOtp || undefined) : undefined, transactionId: withTradingAuth ? (ssiTransactionId || undefined) : undefined });
      const result = response.data;
      if (!result?.ok) throw new Error(result?.error?.message ?? 'SSI connection failed');
      const accounts: SsiAccount[] = result.data?.accounts ?? [];
      setSsiTested(true);
      setSsiAccounts(accounts);
      setSsiAccountNo(current => current && accounts.some(a => a.accountNo === current) ? current : accounts[0]?.accountNo ?? '');
      setSsiTradingVerified(withTradingAuth && accounts.length > 0);
      const message = withTradingAuth
        ? accounts.length
          ? `Trading OK — ${accounts.length} account(s)`
          : 'Trading authenticated — no account returned'
        : 'API connection OK — verify trading access to load accounts';
      setStatus(s => ({ ...s, ssi: message }));
    } catch (e: any) {
      setSsiTested(false);
      setSsiTradingVerified(false);
      setStatus(s => ({ ...s, ssi: readError(e) }));
    } finally {
      setBusy(null);
    }
  }

  async function requestSsiOtp() {
    if (!ssi.apiKey || !ssi.apiSecret) {
      setStatus(s => ({ ...s, ssi: 'API Key and API Secret are required' }));
      return;
    }
    await run('ssi', async () => {
      const response = await platformApi.ssiOtp({ environment: ssiEnv, credentials: ssi });
      const result = response.data;
      if (!result?.ok) throw new Error(result?.error?.message ?? 'Unable to request SSI OTP');
      if (result.data?.transactionId) setSsiTransactionId(String(result.data.transactionId));
    }, 'OTP requested — enter OTP and verify');
  }

  async function saveTestedSsi() {
    if (!ssiTradingVerified || !ssiAccountNo) {
      setStatus(s => ({ ...s, ssi: 'Verify trading access and select an account before saving' }));
      return;
    }
    await run('ssi', async () => {
      const response = await platformApi.ssiSaveTested({ environment: ssiEnv, credentials: ssi, accountNo: ssiAccountNo, otp: ssiOtp || undefined, transactionId: ssiTransactionId || undefined });
      const result = response.data;
      if (!result?.ok) throw new Error(result?.error?.message ?? 'Unable to save SSI credentials');
    }, 'Saved');
    setSsiEditing(false);
    await loadConfig();
  }

  async function saveBinance() {
    await run('binance', () => platformApi.save('binance', binanceEnv, binance), 'Saved');
    setBinanceEditing(false);
    await loadConfig();
  }

  function editSsi() {
    setSsiEditing(true);
    setSsi({ ...emptySsi });
    setSsiTested(false);
    setSsiTradingVerified(false);
    setStatus(s => ({ ...s, ssi: 'Edit credentials' }));
  }

  function editBinance() {
    setBinanceEditing(true);
    setBinance({ apiKey: '', apiSecret: '' });
    setStatus(s => ({ ...s, binance: 'Edit credentials' }));
  }

  return (
    <div className="space-y-4">
      <div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#887b91]">Platform configuration</p><h2 className="mt-1 text-xl font-semibold">Connections & environments</h2><p className="mt-1 text-sm text-zinc-400">Configure credentials locally, test them, then save the verified connection.</p></div>
      <Tabs defaultValue="ssi" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="ssi">SSI FastConnect</TabsTrigger><TabsTrigger value="binance">Binance Futures</TabsTrigger><TabsTrigger value="fastapi">FastAPI</TabsTrigger></TabsList>
        <TabsContent value="ssi">
          <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>SSI FastConnect</CardTitle><CardDescription>Core credentials only. JSON import is local.</CardDescription></div><StatusBadge value={status.ssi}/></div></CardHeader><CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Environment"><select value={ssiEnv} onChange={e => setSsiEnv(e.target.value as 'production' | 'sandbox')} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60"><option value="production">Production</option><option value="sandbox">Sandbox</option></select></Field>{ssiEditing && <Field label="JSON config"><div className="flex h-11 items-center gap-2"><input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={e => { const file = e.target.files?.[0]; if (file) void importSsiJson(file); }} /><Button type="button" variant="outline" disabled={!!busy} onClick={() => fileRef.current?.click()}><Upload className="size-4"/>Upload JSON</Button>{jsonName && <span className="min-w-0 truncate text-xs text-zinc-400"><FileJson className="mr-1 inline size-3.5"/>{jsonName}</span>}</div></Field>}</div>
            {!ssiEditing ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4"><div><p className="text-sm font-medium">SSI credentials saved</p><p className="text-xs text-zinc-500">Credentials are stored securely. The secret values are not displayed.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!!busy} onClick={() => void testSsi()}><Wifi className="size-4"/>Test connection</Button><Button type="button" variant="outline" disabled={!!busy} onClick={editSsi}><Pencil className="size-4"/>Edit</Button></div></div> : <>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="API Key"><Input value={ssi.apiKey} onChange={e => { setSsi({ ...ssi, apiKey: e.target.value }); resetSsiTest(); }} type="password" autoComplete="new-password" /></Field><Field label="API Secret"><Input value={ssi.apiSecret} onChange={e => { setSsi({ ...ssi, apiSecret: e.target.value }); resetSsiTest(); }} type="password" autoComplete="new-password" /></Field><Field label="Private Key"><textarea value={ssi.privateKey} onChange={e => { setSsi({ ...ssi, privateKey: e.target.value }); resetSsiTest(); }} rows={4} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60" autoComplete="off" /></Field></div>
              {ssiTested && <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">Trading access</span><span className="text-xs text-zinc-500">OTP is required by SSI for account/trading APIs.</span></div><div className="flex flex-wrap gap-2"><Input className="w-40" value={ssiOtp} onChange={e => setSsiOtp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="OTP" /><Button type="button" variant="outline" disabled={!!busy} onClick={() => void requestSsiOtp()}>Request OTP</Button><Button type="button" variant="outline" disabled={!!busy || (!ssiOtp && !ssiTransactionId)} onClick={() => void testSsi(true)}><Wifi className="size-4"/>Verify trading</Button></div>{ssiAccounts.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-zinc-400">Account</span><select value={ssiAccountNo} onChange={e => setSsiAccountNo(e.target.value)} className="h-10 min-w-48 rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60">{ssiAccounts.map(account => <option key={account.accountNo} value={account.accountNo}>{account.accountNo} · {account.accountType}</option>)}</select><Button type="button" disabled={!!busy || !ssiTradingVerified || !ssiAccountNo} onClick={() => void saveTestedSsi()}><Save className="size-4"/>Save</Button></div>}</div>}
              <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!!busy} onClick={() => void testSsi()}><Wifi className="size-4"/>Test connection</Button>{ssiTradingVerified && ssiAccountNo && <Button type="button" disabled={!!busy} onClick={() => void saveTestedSsi()}><Save className="size-4"/>Save</Button>}<Button type="button" variant="ghost" disabled={!!busy} onClick={() => { setSsiEditing(false); setStatus(s => ({ ...s, ssi: 'Configured' })); }}><X className="size-4"/>Cancel</Button></div>
            </>}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="binance"><Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Binance Futures</CardTitle><CardDescription>Environment is shared by save and connection test.</CardDescription></div><StatusBadge value={status.binance}/></div></CardHeader><CardContent className="space-y-4"><Field label="Environment"><select value={binanceEnv} onChange={e => setBinanceEnv(e.target.value as 'production' | 'testnet')} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60"><option value="testnet">Testnet</option><option value="production">Production</option></select></Field>{!binanceEditing ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4"><div><p className="text-sm font-medium">Binance credentials saved</p><p className="text-xs text-zinc-500">Credentials are stored securely. The secret values are not displayed.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!!busy} onClick={() => void run('binance', () => platformApi.binanceTest(binanceEnv), 'Connection OK')}><Wifi className="size-4"/>Test connection</Button><Button type="button" variant="outline" disabled={!!busy} onClick={editBinance}><Pencil className="size-4"/>Edit</Button></div></div> : <><div className="grid gap-3 sm:grid-cols-2"><Field label="API Key"><Input value={binance.apiKey} onChange={e => setBinance({ ...binance, apiKey: e.target.value })} type="password" autoComplete="new-password" /></Field><Field label="API Secret"><Input value={binance.apiSecret} onChange={e => setBinance({ ...binance, apiSecret: e.target.value })} type="password" autoComplete="new-password" /></Field></div><div className="flex flex-wrap gap-2"><Button type="button" disabled={!!busy} onClick={() => void saveBinance()}><Save className="size-4"/>Save</Button><Button type="button" variant="outline" disabled={!!busy} onClick={() => void run('binance', () => platformApi.binanceTest(binanceEnv), 'Connection OK')}><Wifi className="size-4"/>Test connection</Button>{binanceConfigured && <Button type="button" variant="ghost" disabled={!!busy} onClick={() => { setBinanceEditing(false); setStatus(s => ({ ...s, binance: 'Configured' })); }}><X className="size-4"/>Cancel</Button>}</div></>}</CardContent></Card></TabsContent>
        <TabsContent value="fastapi"><Card><CardHeader><CardTitle>FastAPI</CardTitle><CardDescription>Backend service connection metadata.</CardDescription></CardHeader><CardContent className="space-y-4"><Field label="Base URL"><Input value={fastapi.baseUrl} onChange={e => setFastapi({ ...fastapi, baseUrl: e.target.value })} placeholder="https://api.example.com" inputMode="url" /></Field><Field label="Health path"><Input value={fastapi.healthPath} onChange={e => setFastapi({ ...fastapi, healthPath: e.target.value })} placeholder="/health" /></Field><Button type="button" disabled={!!busy} onClick={() => void run('fastapi', () => platformApi.saveFastApi(fastapi), 'Saved')}><Save className="size-4"/>Save configuration</Button></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className}`}><label className="text-xs font-medium text-zinc-300">{label}</label>{children}</div>;
}

function StatusBadge({ value }: { value?: string }) {
  if (!value) return null;
  const ok = /configured|saved|ok/i.test(value);
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] ${ok ? 'border-emerald-400/20 text-emerald-300' : 'border-white/10 text-zinc-400'}`}>{value}</span>;
}
