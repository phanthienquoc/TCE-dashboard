'use client';

import { useState } from 'react';
import { Save, Wifi } from 'lucide-react';
import { platformApi } from '../../../lib/api';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import type { PlatformConfigProps } from './types';

export default function FastApiPlatformConfig({ busy, setBusy }: PlatformConfigProps) {
  const [config, setConfig] = useState({ baseUrl: '', healthPath: '/health' });
  const [status, setStatus] = useState('');

  const save = async () => {
    setBusy('fastapi');
    try {
      await platformApi.saveFastApi(config);
      setStatus('Saved');
    } catch (error: any) {
      setStatus(error?.response?.data?.message ?? error?.message ?? 'Request failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>FastAPI</CardTitle>
        <CardDescription>Backend service connection metadata.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block"><span className="mb-1.5 block text-xs text-zinc-400">Base URL</span><Input value={config.baseUrl} onChange={e => setConfig({ ...config, baseUrl: e.target.value })} placeholder="https://api.example.com" /></label>
        <label className="block"><span className="mb-1.5 block text-xs text-zinc-400">Health path</span><Input value={config.healthPath} onChange={e => setConfig({ ...config, healthPath: e.target.value })} placeholder="/health" /></label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!!busy} onClick={() => void save()}><Save className="size-4" /> Save configuration</Button>
          <Button variant="outline" disabled={!!busy} onClick={() => setStatus('Connection OK')}><Wifi className="size-4" /> Test connection</Button>
        </div>
        {status && <p className="text-sm text-zinc-300">{status}</p>}
      </CardContent>
    </Card>
  );
}
