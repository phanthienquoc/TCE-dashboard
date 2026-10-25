'use client';

import {
  CheckCircle2,
  ChevronRight,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardShell from '../../components/dashboard/DashboardShell';
import { useAuthStore } from '../../lib/store';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, loading } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const email = user?.email ?? 'Signed-in user';
  const role = user?.role ?? '—';
  const mfaEnabled = Boolean(user?.mfaEnabled);
  const accountId = user?.id ?? '—';

  return (
    <DashboardShell view="profile">
      {() => (
        <div className="tce-mobile-view">
          <div className="tce-section-row mb-5">
            <div>
              <span className="tce-label">PROFILE</span>
              <strong>Account</strong>
            </div>
            <UserCircle className="size-5" />
          </div>

          <section className="tce-settings-card mb-5 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-[rgba(85,191,255,0.09)] text-[var(--tce-blue)]">
                <UserCircle className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-[15px]">{email}</strong>
                <span className="mt-1 block truncate text-xs text-[var(--tce-muted)]">
                  Account ID · {accountId}
                </span>
              </div>
              <span className="shrink-0 rounded-full border border-[rgba(85,191,255,0.18)] bg-[rgba(85,191,255,0.07)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--tce-blue)]">
                {role}
              </span>
            </div>
          </section>

          <div className="mb-2 px-1">
            <span className="tce-label">SECURITY</span>
          </div>
          <section className="tce-settings-card mb-5 overflow-hidden">
            <div className="tce-row-card items-center">
              <ShieldCheck className="size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <strong>Multi-factor authentication</strong>
                <span>
                  {mfaEnabled ? 'Enabled · Account protected' : 'Not enabled · Recommended'}
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${
                  mfaEnabled
                    ? 'bg-[rgba(49,233,129,0.09)] text-[var(--tce-green)]'
                    : 'bg-[rgba(244,184,96,0.1)] text-[var(--warning)]'
                }`}
              >
                {mfaEnabled ? 'Enabled' : 'Recommended'}
              </span>
            </div>
            <button
              type="button"
              className="tce-row-card w-full text-left transition-opacity hover:opacity-90 active:opacity-80"
              onClick={() => router.push('/profile/passkey')}
            >
              <KeyRound className="size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <strong>Passkeys</strong>
                <span>Manage passwordless sign-in devices.</span>
              </div>
              <ChevronRight className="size-4 shrink-0 text-[var(--tce-muted)]" />
            </button>
          </section>

          <div className="mb-2 px-1">
            <span className="tce-label">SESSION</span>
          </div>
          <section className="tce-settings-card overflow-hidden">
            <button
              type="button"
              className="tce-row-card w-full text-left transition-opacity hover:opacity-90 active:opacity-80"
              onClick={() => void handleLogout()}
              disabled={loading}
            >
              <LogOut className="size-5 shrink-0 text-[var(--danger)]" />
              <div className="min-w-0 flex-1">
                <strong>{loading ? 'Signing out…' : 'Sign out'}</strong>
                <span>End the current TCE session.</span>
              </div>
              {!loading && <CheckCircle2 className="size-4 shrink-0 text-[var(--tce-muted)]" />}
            </button>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
