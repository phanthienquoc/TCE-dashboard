'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, FileJson, Save, ShieldCheck, Upload, Wifi } from 'lucide-react';
import { platformApi } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

type SsiCredentials = { clientId: string; apiKey: string; apiSecret: string; accountNo: string; privateKey: string };

const emptySsi: SsiCredentials = { clientId: '', apiKey: '', apiSecret: '', accountNo: '', privateKey: '' };

export default function PlatformConfigTab() {
  const [ssiEnv, setSsiEnv] = useState<'production' | 'sandbox'>('production');
  const [ssi, setSsi] = useState<SsiCredentials>(emptySsi);
  const [binanceEnv, setBinanceEnv] = useState<'production' | 'testnet'>('testnet');
  const [binance, setBinance] = useState({ apiKey: '', apiSecret: '' });
  const [fastapi, setFastapi] = useState({ baseUrl: '', healthPath: '/health' });
  const [status, setStatus] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [ssiOpen, setSsiOpen] = useState(true);
  const [binanceOpen, setBinanceOpen] = useState(true);
  const [jsonName, setJsonName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void loadConfig(); }, []);

  async function loadConfig() {
    try {
      const [credentials, fast] = await Promise.all([platformApi.credentials(), platformApi.fastApiConfig()]);
      const rows = credentials.data?.credentials ?? credentials.data ?? [];
      const has = (provider: string, environment: string) => Array.isArray(rows)
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
      const source = parsed?.credentials ?? parsed?.ssi ?? parsed;
      if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('JSON root must be an object');
      const pick = (...keys: string[]) => {
        for (const key of keys) if (source[key] !== undefined && source[key] !== null) return String(source[key]);
        return '';
      };
      const imported: SsiCredentials = {
        clientId: pick('clientId', 'client_id', 'clientID'),
        apiKey: pick('apiKey', 'api_key', 'apikey'),
        apiSecret: pick('apiSecret', 'api_secret', 'secret'),
        accountNo: pick('accountNo', 'accountNO', 'account_no', 'accountNumber', 'account_number'),
        privateKey: pick('privateKey', 'private_key', 'privateKEY'),
      };
      if (!Object.values(imported).some(Boolean)) throw new Error('No SSI credential fields found');
      setSsi(imported);
      setJsonName(file.name);
      setStatus(s => ({ ...s, ssi: 'JSON loaded — review before save' }));
    } catch (e: any) {
      setStatus(s => ({ ...s, ssi: `JSON import failed: ${e?.message ?? 'Invalid file'}` }));
      setJsonName('');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function run(key: string, action: () => Promise<any>, success: string) {
    setBusy(key);
    setStatus(s => ({ ...s, [key]: 'Working…' }));
    try { await action(); setStatus(s => ({ ...s, [key]: success })); }
    catch (e: any) { setStatus(s => ({ ...s, [key]: e?.response?.data?.message ?? 'Request failed' })); }
    finally { setBusy(null); }
  }

  return <div className="space-y-4">
    <div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#887b91]">Platform configuration</p><h2 className="mt-1 text-xl font-semibold">Connections & environments</h2><p className="mt-1 text-sm text-zinc-400">Secrets stay in memory until you save them. Imported JSON is never uploaded directly to the browser server.</p></div>
    <Tabs defaultValue="ssi" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="ssi">SSI FastConnect</TabsTrigger><TabsTrigger value="binance">Binance Futures</TabsTrigger><TabsTrigger value="fastapi">FastAPI</TabsTrigger></TabsList>
      <TabsContent value="ssi">
        <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>SSI FastConnect</CardTitle><CardDescription>Production / Sandbox credentials.</CardDescription></div><StatusBadge value={status.ssi}/></div></CardHeader><CardContent className="space-y-4">
          <SelectField label="Environment" value={ssiEnv} onChange={v => setSsiEnv(v as 'production' | 'sandbox')} options={[['production', 'Production'], ['sandbox', 'Sandbox']]} />
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={e => { const file = e.target.files?.[0]; if (file) void importSsiJson(file); }} />
            <Button type="button" variant="outline" disabled={!!busy} onClick={() => fileRef.current?.click()}><Upload className="size-4"/>Upload JSON config</Button>
            {jsonName ? <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-zinc-400"><FileJson className="size-4 shrink-0"/><span className="truncate">{jsonName}</span></span> : <span className="text-xs text-zinc-500">Maps client ID, API key/secret, account no. and private key.</span>}
          </div>
          <button type="button" onClick={() => setSsiOpen(v => !v)} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium"><span>Credential configuration</span><ChevronDown className={`size-4 transition-transform ${ssiOpen ? 'rotate-180' : ''}`} /></button>
          {ssiOpen && <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Client ID"><Input value={ssi.clientId} onChange={e => setSsi({ ...ssi, clientId: e.target.value })} autoComplete="off" /></Field>
            <Field label="Account No."><Input value={ssi.accountNo} onChange={e => setSsi({ ...ssi, accountNo: e.target.value })} autoComplete="off" placeholder="SSI account number" /></Field>
            <Field label="API Key"><Input value={ssi.apiKey} onChange={e => setSsi({ ...ssi, apiKey: e.target.value })} type="password" autoComplete="new-password" /></Field>
            <Field label="API Secret"><Input value={ssi.apiSecret} onChange={e => setSsi({ ...ssi, apiSecret: e.target.value })} type="password" autoComplete="new-password" /></Field>
            <Field label="Private Key" className="sm:col-span-2"><textarea value={ssi.privateKey} onChange={e => setSsi({ ...ssi, privateKey: e.target.value })} rows={5} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60" autoComplete="off" /></Field>
          </div>}
          <div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => run('ssi', () => platformApi.save('ssi', ssiEnv, ssi), 'Saved')}><Save className="size-4"/>Save</Button><Button variant="outline" disabled={!!busy} onClick={() => run('ssi', () => platformApi.ssiTest({ environment: ssiEnv, credentials: ssi }), 'Connection OK')}><Wifi className="size-4"/>Test connection</Button></div>
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="binance">
        <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Binance Futures</CardTitle><CardDescription>Environment is shared by save and connection test.</CardDescription></div><StatusBadge value={status.binance}/></div></CardHeader><CardContent className="space-y-4">
          <SelectField label="Environment" value={binanceEnv} onChange={v => setBinanceEnv(v as 'production' | 'testnet')} options={[['testnet', 'Testnet'], ['production', 'Production']]} />
          <button type="button" onClick={() => setBinanceOpen(v => !v)} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium"><span>Credential configuration</span><ChevronDown className={`size-4 transition-transform ${binanceOpen ? 'rotate-180' : ''}`} /></button>
          {binanceOpen && <div className="grid gap-3 sm:grid-cols-2"><Field label="API Key"><Input value={binance.apiKey} onChange={e => setBinance({ ...binance, apiKey: e.target.value })} type="password" autoComplete="new-password" /></Field><Field label="API Secret"><Input value={binance.apiSecret} onChange={e => setBinance({ ...binance, apiSecret: e.target.value })} type="password" autoComplete="new-password" /></Field></div>}
          <p className="text-xs text-zinc-500">Base URL: {binanceEnv === 'testnet' ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com'}</p>
          <div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => run('binance', () => platformApi.save('binance', binanceEnv, binance), 'Saved')}><Save className="size-4"/>Save</Button><Button variant="outline" disabled={!!busy} onClick={() => run('binance', () => platformApi.binanceTest(binanceEnv), 'Connection OK')}><Wifi className="size-4"/>Test connection</Button></div>
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="fastapi">
        <Card><CardHeader><CardTitle>FastAPI</CardTitle><CardDescription>Backend service connection metadata.</CardDescription></CardHeader><CardContent className="space-y-4"><Field label="Base URL"><Input value={fastapi.baseUrl} onChange={e => setFastapi({ ...fastapi, baseUrl: e.target.value })} placeholder="https://api.example.com" inputMode="url" /></Field><Field label="Health path"><Input value={fastapi.healthPath} onChange={e => setFastapi({ ...fastapi, healthPath: e.target.value })} placeholder="/health" /></Field><Button disabled={!!busy} onClick={() => run('fastapi', () => platformApi.saveFastApi(fastapi), 'Saved')}><Save className="size-4"/>Save configuration</Button></CardContent></Card>
      </TabsContent>
    </Tabs>
  </div>;
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) { return <div className={`space-y-1.5 ${className}`}><label className="text-xs font-medium text-zinc-300">{label}</label>{children}</div>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) { return <Field label={label}><select value={value} onChange={e => onChange(e.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#120b18] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400/60">{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Field>; }
function StatusBadge({ value }: { value?: string }) { const ok = value === 'Configured' || value === 'Connection OK' || value === 'Saved'; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${ok ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.06] text-zinc-400'}`}>{ok ? <CheckCircle2 className="size-3.5"/> : <ShieldCheck className="size-3.5"/>}{value ?? 'Not configured'}</span>; }
