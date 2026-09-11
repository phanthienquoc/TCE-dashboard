'use client';

import { CheckCircle2, KeyRound, LogOut, ShieldCheck, UserCircle } from 'lucide-react';
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

  return (
    <DashboardShell view="profile">
      {() => (
        <div className="tce-mobile-view">
          <div className="tce-section-row">
            <div><span className="tce-label">ACCOUNT</span><strong>Profile</strong></div>
            <UserCircle className="size-5" />
          </div>
          <section className="tce-settings-card">
            <div className="tce-row-card">
              <UserCircle className="size-5" />
              <div><strong>{user?.email ?? 'Signed-in user'}</strong><span>User ID · {user?.id ?? '—'}</span></div>
            </div>
            <div className="tce-row-card">
              <ShieldCheck className="size-5" />
              <div><strong>Role</strong><span>{user?.role ?? '—'}</span></div>
            </div>
            <div className="tce-row-card">
              <CheckCircle2 className="size-5" />
              <div><strong>MFA</strong><span>{user?.mfaEnabled ? 'Enabled' : 'Not enabled'}</span></div>
            </div>
          </section>
          <section className="tce-settings-card">
            <button type="button" className="tce-row-card" onClick={() => router.push('/profile/passkey')}>
              <KeyRound className="size-5" />
              <div><strong>Passkeys</strong><span>Register and manage passwordless sign-in devices.</span></div>
            </button>
          </section>
          <section className="tce-settings-card">
            <button type="button" className="tce-row-card" onClick={() => void handleLogout()} disabled={loading}>
              <LogOut className="size-5" />
              <div><strong>{loading ? 'Signing out…' : 'Logout'}</strong><span>Sign out of TCE</span></div>
            </button>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
