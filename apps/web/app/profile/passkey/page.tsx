'use client';

import { useEffect } from 'react';
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import { usePasskeyStore } from '../../../lib/passkey-store';

export default function ProfilePasskeyPage() {
  const passkeys = usePasskeyStore(state => state.passkeys);
  const loading = usePasskeyStore(state => state.loading);
  const busy = usePasskeyStore(state => state.busy);
  const error = usePasskeyStore(state => state.error);
  const success = usePasskeyStore(state => state.success);
  const load = usePasskeyStore(state => state.load);
  const add = usePasskeyStore(state => state.add);
  const rename = usePasskeyStore(state => state.rename);
  const remove = usePasskeyStore(state => state.remove);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardShell view="profile">
      {() => (
        <div className="tce-mobile-view tce-passkey-view">
          <div className="mb-6 flex items-end justify-between gap-4 px-1">
            <div>
              <span className="tce-label">SECURITY</span>
              <strong className="mt-1 block text-[22px] tracking-[-0.035em]">Passkeys</strong>
              <span className="mt-1 block text-[11px] text-[var(--tce-muted)]">
                Secure, passwordless access to your TCE account.
              </span>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-[var(--tce-text)]">
              <KeyRound className="size-5" />
            </div>
          </div>

          <section className="mb-3 rounded-2xl border border-white/[0.07] bg-[rgba(11,23,30,0.72)] px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[rgba(85,191,255,0.08)] text-[var(--tce-blue)]">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <strong className="block text-[15px] text-[var(--tce-text)]">Passwordless sign-in</strong>
                <span className="mt-1.5 block text-[10px] leading-[1.55] text-[var(--tce-muted)]">
                  Use Face ID, Touch ID, a security key, or your device PIN to access TCE.
                </span>
              </div>
            </div>
          </section>

          <button
            type="button"
            className="mb-7 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[rgba(49,233,129,0.24)] bg-[rgba(49,233,129,0.09)] px-4 text-left transition hover:bg-[rgba(49,233,129,0.13)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void add()}
            disabled={busy}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[rgba(49,233,129,0.13)] text-[var(--tce-green)]">
              <Plus className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-[13px] text-[var(--tce-text)]">{busy ? 'Registering passkey…' : 'Register a passkey'}</strong>
              <span className="mt-1 block text-[9px] text-[var(--tce-muted)]">Add this device or a security key to your account.</span>
            </span>
          </button>

          {(error || success) && (
            <div className="mb-5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3" role="status">
              <strong className="block text-[11px] text-[var(--tce-text)]">{error ? 'Passkey error' : 'Success'}</strong>
              <span className="mt-1 block text-[9px] leading-4 text-[var(--tce-muted)]">{error || success}</span>
            </div>
          )}

          <section>
            <div className="mb-2.5 flex items-end justify-between px-1">
              <div><span className="tce-label">REGISTERED</span><strong className="mt-1 block text-[15px] text-[var(--tce-text)]">Your passkeys</strong></div>
              <span className="rounded-full bg-white/[0.035] px-2 py-1 text-[9px] font-bold text-[var(--tce-muted)]">{passkeys.length}</span>
            </div>
            {loading ? (
              <div className="rounded-2xl border border-white/[0.07] bg-[rgba(11,23,30,0.72)] px-4 py-4"><strong className="block text-[12px] text-[var(--tce-text)]">Loading passkeys…</strong><span className="mt-1 block text-[9px] text-[var(--tce-muted)]">Checking registered devices.</span></div>
            ) : passkeys.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.018] px-4 py-5 text-center"><div className="mx-auto grid size-10 place-items-center rounded-xl bg-white/[0.035] text-[var(--tce-muted)]"><KeyRound className="size-5" /></div><strong className="mt-3 block text-[12px] text-[var(--tce-text)]">No passkeys registered</strong><span className="mt-1 block text-[9px] text-[var(--tce-muted)]">Register one above to enable passwordless sign-in.</span></div>
            ) : (
              <div className="space-y-2">
                {passkeys.map(passkey => (
                  <div className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-white/[0.07] bg-[rgba(11,23,30,0.78)] px-3.5 py-3" key={passkey.id}>
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.035] text-[var(--tce-text)]"><KeyRound className="size-5" /></div>
                    <div className="min-w-0 flex-1"><strong className="block truncate text-[13px] text-[var(--tce-text)]">{passkey.friendly_name}</strong><span className="mt-1 block truncate text-[9px] text-[var(--tce-muted)]">Added {new Date(passkey.created_at).toLocaleDateString()}{passkey.last_used_at ? ` · Last used ${new Date(passkey.last_used_at).toLocaleDateString()}` : ' · Never used'}</span></div>
                    <div className="flex shrink-0 gap-1.5">
                      <button type="button" className="grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-[var(--tce-muted)] transition hover:bg-white/[0.06] hover:text-[var(--tce-text)] active:scale-95 disabled:opacity-40" aria-label={`Rename ${passkey.friendly_name}`} onClick={() => void rename(passkey)} disabled={busy}><Pencil className="size-4" /></button>
                      <button type="button" className="grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-[var(--tce-muted)] transition hover:border-[rgba(255,94,114,0.25)] hover:bg-[rgba(255,94,114,0.07)] hover:text-[var(--tce-red)] active:scale-95 disabled:opacity-40" aria-label={`Remove ${passkey.friendly_name}`} onClick={() => void remove(passkey)} disabled={busy}><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
