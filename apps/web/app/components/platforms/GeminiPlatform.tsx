'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, FileJson, KeyRound, Loader2, Upload, XCircle } from 'lucide-react';
import { platformApi } from '../../../lib/api';

type Props = { onMessage?: (message: string) => void };
type ResultState = { ok: boolean; message: string } | null;

type GeminiModel = {
  id: string;
  label: string;
  description: string;
  freeTier: boolean;
};

const GEMINI_MODELS: GeminiModel[] = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Best default for TCE signal parsing and reasoning',
    freeTier: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite',
    description: 'Fastest and most budget-friendly 2.5 model',
    freeTier: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    description: 'High-volume, cost-efficient agentic workloads',
    freeTier: true,
  },
];

const pick = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

function credentialsFromJson(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('JSON root must be an object');
  const root = value as Record<string, unknown>;
  const nested =
    root.credentials && typeof root.credentials === 'object' && !Array.isArray(root.credentials)
      ? (root.credentials as Record<string, unknown>)
      : {};
  const source = { ...root, ...nested };
  return {
    apiKey: pick(source, 'apiKey', 'api_key', 'geminiApiKey', 'gemini_api_key'),
    model: pick(source, 'model', 'modelName', 'model_name'),
  };
}

export default function GeminiPlatform({ onMessage }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(GEMINI_MODELS[0].id);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResultState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadJson = async (file?: File) => {
    if (!file) return;
    setResult(null);
    try {
      if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json')
        throw new Error('Please select a JSON file');
      const parsed = JSON.parse(await file.text());
      const next = credentialsFromJson(parsed);
      if (!next.apiKey) throw new Error('JSON must contain apiKey (or geminiApiKey)');
      setApiKey(next.apiKey);
      if (next.model && GEMINI_MODELS.some(item => item.id === next.model)) setModel(next.model);
      setFileName(file.name);
      setResult({ ok: true, message: `Loaded Gemini credentials from ${file.name}.` });
      onMessage?.(`Loaded Gemini credentials from ${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'JSON upload failed';
      setResult({ ok: false, message });
      onMessage?.(`Gemini JSON upload failed: ${message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const save = async () => {
    if (!apiKey.trim()) {
      setResult({ ok: false, message: 'Gemini API Key is required.' });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      await platformApi.save('gemini', 'production', { apiKey: apiKey.trim(), model });
      const selected = GEMINI_MODELS.find(item => item.id === model);
      setResult({ ok: true, message: `${selected?.label ?? model} credentials saved securely.` });
      onMessage?.(`Gemini credentials saved with ${model}`);
    } catch (error) {
      const value = error as { response?: { data?: { message?: string } }; message?: string };
      const message = value?.response?.data?.message ?? value?.message ?? 'Save failed';
      setResult({ ok: false, message });
      onMessage?.(`Gemini credential save failed: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-5 overflow-hidden rounded-[22px] border border-emerald-200/[0.09] bg-[#0d1714] shadow-[0_18px_50px_rgba(0,0,0,.18)]">
      <div className="flex min-h-16 items-center justify-between gap-4 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-200">
            <KeyRound className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">Gemini Engine</p>
            <p className="mt-0.5 truncate text-xs text-[#81748a]">Signal Parser · Production</p>
          </div>
        </div>
      </div>

      <div className="border-t border-emerald-200/[0.07] px-5 pb-5 pt-4">
        <label className="block text-xs text-[#9c91a3]">
          Model
          <select
            className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-emerald-300/30"
            value={model}
            onChange={event => setModel(event.target.value)}
            disabled={busy}
          >
            {GEMINI_MODELS.map(item => (
              <option key={item.id} value={item.id}>
                {item.label} · {item.freeTier ? 'Free tier' : 'Paid'}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-[#81748a]">
            {GEMINI_MODELS.find(item => item.id === model)?.description} · Free-tier availability and limits are subject to Google AI Studio pricing.
          </span>
        </label>

        <div className="mb-4 mt-4 flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={event => void uploadJson(event.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200/10 bg-emerald-300/[0.05] px-3 text-sm font-medium text-emerald-100 disabled:opacity-50"
          >
            <Upload className="size-4" /> Upload JSON
          </button>
          {fileName && (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] px-3 text-xs text-emerald-200">
              <FileJson className="size-4" /> {fileName}
            </span>
          )}
        </div>

        <label className="block text-xs text-[#9c91a3]">
          Gemini API Key
          <input
            className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-emerald-300/30"
            type="password"
            value={apiKey}
            onChange={event => {
              setApiKey(event.target.value);
              setFileName('');
              setResult(null);
            }}
            placeholder="AIza..."
            autoComplete="new-password"
          />
        </label>

        <button
          type="button"
          disabled={busy || !apiKey.trim()}
          onClick={() => void save()}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Save Credential
        </button>

        {result && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
              result.ok
                ? 'border-emerald-300/10 bg-emerald-300/[0.04] text-emerald-200'
                : 'border-red-300/10 bg-red-300/[0.04] text-red-200'
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{result.message}</span>
          </div>
        )}
      </div>
    </section>
  );
}
