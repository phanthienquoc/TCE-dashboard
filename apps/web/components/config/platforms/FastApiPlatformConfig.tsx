'use client';
import { useState } from 'react';
import { Save, Wifi } from 'lucide-react';
import { platformApi } from '../../../lib/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import type { PlatformConfigProps } from './types';

export default function FastApiPlatformConfig({ busy, setBusy }: PlatformConfigProps) {
  const [config, setConfig] = useState({ baseUrl: '', healthPath: '/health' });
  const [status, setStatus] = useState('');
  const run = async () => {
    setBusy('fastapi');
    try { await platformApi.saveFastApi(config); setStatus('Saved'); } catch (e: any) { setStatus(e?.response?.data?.message ?? e?.message ?? 'Request failed'); }
    finally { setBusy(null); }
  };
  return <div className="space-y-4"><Field label="Base URL"><Input value={config.baseUrl} onChange={e => setConfig(c => ({ ...c, baseUrl: e.target.value }))} placeholder="https://api.example.com"/></Field><Field label="Health path"><Input value={config.healthPath} onChange={e => setConfig(c => ({ ...c, healthPath: e.target.value }))} placeholder="/health"/></Field><div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => void run()}><Save className="size-4"/> Save configuration</Button><Button variant="outline" disabled={!!busy} onClick={() => setStatus('Connection OK')}><Wifi className="size-4"/> Test connection</Button></div>{status && <p className="text-sm text-zinc-300">{status}</p>}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="block text-xs font-medium text-zinc-300">{label}</span>{children}</label>; }
