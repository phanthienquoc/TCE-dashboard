'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { registerPasskey } from '../../../lib/passkey';
import DashboardShell from '../../../components/dashboard/DashboardShell';

interface PasskeyRecord {
  id: string;
  credential_id: string;
  friendly_name: string;
  created_at: string;
  last_used_at?: string | null;
}

const messageFromError = (error: any, fallback: string) =>
  error?.response?.data?.message ?? error?.message ?? fallback;

export default function ProfilePasskeyPage() {
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<PasskeyRecord[]>('/auth/passkeys');
      setPasskeys(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(messageFromError(err, 'Unable to load passkeys'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const addPasskey = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await registerPasskey();
      await load();
      setSuccess('Passkey registered successfully.');
    } catch (err) {
      setError(messageFromError(err, 'Unable to register passkey'));
    } finally {
      setBusy(false);
    }
  };

  const renamePasskey = async (passkey: PasskeyRecord) => {
    const friendlyName = window.prompt('Passkey name', passkey.friendly_name);
    if (friendlyName === null || !friendlyName.trim()) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.patch(`/auth/passkeys/${encodeURIComponent(passkey.id)}`, {
        friendlyName: friendlyName.trim(),
      });
      await load();
      setSuccess('Passkey name updated.');
    } catch (err) {
      setError(messageFromError(err, 'Unable to rename passkey'));
    } finally {
      setBusy(false);
    }
  };

  const removePasskey = async (passkey: PasskeyRecord) => {
    if (!window.confirm(`Remove “${passkey.friendly_name}”? You will no longer be able to use it to sign in.`))
      return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.delete(`/auth/passkeys/${encodeURIComponent(passkey.id)}`);
      await load();
      setSuccess('Passkey removed.');
    } catch (err) {
      setError(messageFromError(err, 'Unable to remove passkey'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell view="profile">
      {() => (
        <div className="tce-mobile-view">
          <div className="tce-section-row">
            <div>
              <span className="tce-label">SECURITY</span>
              <strong>Passkeys</strong>
            </div>
            <KeyRound className="size-5" />
          </div>

          <section className="tce-settings-card">
            <div className="tce-row-card">
              <ShieldCheck className="size-5" />
              <div>
                <strong>Passwordless sign-in</strong>
                <span>Use Face ID, Touch ID, a security key, or your device PIN to access TCE.</span>
              </div>
            </div>
            <button
              type="button"
              className="tce-row-card"
              onClick={() => void addPasskey()}
              disabled={busy}
            >
              <Plus className="size-5" />
              <div>
                <strong>{busy ? 'Working…' : 'Register a passkey'}</strong>
                <span>Add this device or security key to your TCE account.</span>
              </div>
            </button>
          </section>

          {(error || success) && (
            <div className="tce-settings-card" role="status">
              <div className="tce-row-card">
                <div>
                  <strong>{error ? 'Passkey error' : 'Success'}</strong>
                  <span>{error || success}</span>
                </div>
              </div>
            </div>
          )}

          <section className="tce-settings-card">
            <div className="tce-section-row">
              <div>
                <span className="tce-label">REGISTERED</span>
                <strong>Your passkeys</strong>
              </div>
              <span className="tce-label">{passkeys.length}</span>
            </div>
            {loading ? (
              <div className="tce-row-card">
                <div>
                  <strong>Loading…</strong>
                  <span>Checking registered passkeys.</span>
                </div>
              </div>
            ) : passkeys.length === 0 ? (
              <div className="tce-row-card">
                <KeyRound className="size-5" />
                <div>
                  <strong>No passkeys registered</strong>
                  <span>Register one above to enable passwordless sign-in.</span>
                </div>
              </div>
            ) : (
              passkeys.map(passkey => (
                <div className="tce-row-card" key={passkey.id}>
                  <KeyRound className="size-5" />
                  <div>
                    <strong>{passkey.friendly_name}</strong>
                    <span>
                      Added {new Date(passkey.created_at).toLocaleDateString()} 
                      {passkey.last_used_at
                        ? ` · Last used ${new Date(passkey.last_used_at).toLocaleDateString()}`
                        : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Rename ${passkey.friendly_name}`}
                    onClick={() => void renamePasskey(passkey)}
                    disabled={busy}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${passkey.friendly_name}`}
                    onClick={() => void removePasskey(passkey)}
                    disabled={busy}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
