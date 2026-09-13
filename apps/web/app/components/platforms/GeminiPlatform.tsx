'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, FileJson, KeyRound, Loader2, Upload, Wifi, XCircle } from 'lucide-react';
import { platformApi } from '../../../lib/api';

type Props = { onMessage?: (message: string) => void };
type ResultState = { ok: boolean; message: string } | null;

const GEMINI_MODEL = 'gemini-flash-latest';
const DEFAULT_TEST_TEXT = 'Explain how AI works in a few words';

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
    text: pick(source, 'text', 'prompt', 'testText', 'test_text'),
  };
}

export default function GeminiPlatform({ onMessage }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [text, setText] = useState(DEFAULT_TEST_TEXT);
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
      if (next.text) setText(next.text);
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

  const testConnection = async () => {
    if (!apiKey.trim()) {
      setResult({ ok: false, message: 'Gemini API Key is required.' });
      return;
    }
    if (!text.trim()) {
      setResult({ ok: false, message: 'Test text is required.' });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const response = await platformApi.geminiTest({
        environment: 'production',
        credentials: { apiKey: apiKey.trim(), text: text.trim() },
      });
      const data = response.data as { message?: string; model?: string };
      setResult({
        ok: true,
        message: data.message ?? `Gemini connection successful for ${data.model ?? GEMINI_MODEL}.`,
      });
      onMessage?.(`Gemini connection test successful for ${data.model ?? GEMINI_MODEL}`);
    } catch (error) {
      const value = error as { response?: { data?: { message?: string } }; message?: string };
      const message =
        value?.response?.data?.message ?? value?.message ?? 'Gemini connection test failed';
      setResult({ ok: false, message });
      onMessage?.(`Gemini connection test failed: ${message}`);
    } finally {
      setBusy(false);
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
      await platformApi.save('gemini', 'production', {
        apiKey: apiKey.trim(),
        model: GEMINI_MODEL,
      });
      setResult({ ok: true, message: 'Gemini credentials saved securely.' });
      onMessage?.(`Gemini credentials saved with ${GEMINI_MODEL}`);
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
    <section className="overflow-hidden rounded-[22px] border border-emerald-200/[0.09] bg-[#0d1714] shadow-[0_18px_50px_rgba(0,0,0,.18)]">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-200">
            <KeyRound className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">Gemini Engine</p>
            <p className="mt-0.5 truncate text-[11px] text-[#81748a]">Signal Parser · Production</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-300/10 bg-emerald-300/[0.04] px-2.5 py-1 text-[10px] font-medium text-emerald-200">
          {GEMINI_MODEL}
        </span>
      </div>

      <div className="border-t border-emerald-200/[0.07] px-4 pb-4 pt-3 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#81748a]">Credential</p>
          <div>
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
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200/10 bg-emerald-300/[0.05] px-2.5 text-xs font-medium text-emerald-100 disabled:opacity-50"
            >
              <Upload className="size-3.5" /> Import JSON
            </button>
          </div>
        </div>

        {fileName && (
          <div className="mt-2 flex min-w-0 items-center gap-2 rounded-lg border border-emerald-300/10 bg-emerald-300/[0.03] px-2.5 py-1.5 text-[11px] text-emerald-200">
            <FileJson className="size-3.5 shrink-0" />
            <span className="truncate">{fileName}</span>
          </div>
        )}

        <label className="mt-3 block text-[11px] text-[#9c91a3]">
          Gemini API Key
          <input
            className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-emerald-300/30"
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

        <label className="mt-2.5 block text-[11px] text-[#9c91a3]">
          Test text
          <input
            className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-emerald-300/30"
            value={text}
            onChange={event => {
              setText(event.target.value);
              setResult(null);
            }}
            disabled={busy}
            spellCheck
          />
        </label>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy || !apiKey.trim() || !text.trim()}
            onClick={() => void testConnection()}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] px-3 text-xs font-semibold text-emerald-100 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wifi className="size-3.5" />}
            Test connection
          </button>
          <button
            type="button"
            disabled={busy || !apiKey.trim()}
            onClick={() => void save()}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-300 px-3 text-xs font-semibold text-slate-950 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Save credential
          </button>
        </div>

        {result && (
          <div
            className={`mt-2.5 flex items-start gap-2 rounded-xl border px-2.5 py-2 text-xs ${
              result.ok
                ? 'border-emerald-300/10 bg-emerald-300/[0.04] text-emerald-200'
                : 'border-red-300/10 bg-red-300/[0.04] text-red-200'
            }`}
          >
            {result.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <XCircle className="mt-0.5 size-3.5 shrink-0" />}
            <span>{result.message}</span>
          </div>
        )}
      </div>
    </section>
  );
}
