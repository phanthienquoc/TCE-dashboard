import { listPasskeys, registerPasskey, renamePasskey, deletePasskey } from './login.js';

const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

export async function securityView() {
  let passkeys = [];
  let error = '';
  try { passkeys = await listPasskeys(); } catch (e) { error = e.message || 'Unable to load passkeys.'; }
  return `<section class="section page-section"><div class="section-head"><div><span class="eyebrow">ACCOUNT SECURITY</span><h2>Passkeys</h2><small>Use Face ID, Touch ID, Windows Hello or a security key.</small></div><span class="status ${passkeys.length ? 'connected' : ''}">${passkeys.length} REGISTERED</span></div><div class="security-card"><div class="security-hero"><div class="security-icon">⌁</div><div><b>Passwordless sign-in</b><span>Passkeys are phishing-resistant credentials stored by your device or password manager.</span></div></div><button class="security-primary" id="add-passkey">＋ Add this device</button><div id="security-error" class="auth-error">${esc(error)}</div><div class="passkey-list">${passkeys.length ? passkeys.map(p => `<div class="passkey-row" data-passkey-id="${esc(p.id)}"><div><b>${esc(p.friendly_name || 'Passkey')}</b><small>Added ${p.created_at ? new Date(p.created_at).toLocaleString() : '—'}${p.last_used_at ? ` • Last used ${new Date(p.last_used_at).toLocaleString()}` : ''}</small></div><div class="passkey-actions"><button data-rename="${esc(p.id)}">Rename</button><button data-delete="${esc(p.id)}">Remove</button></div></div>`).join('') : '<div class="empty">No passkeys registered yet. Add this device to enable passwordless login.</div>'}</div></div></section>`;
}

export function bindSecurity() {
  document.querySelector('#add-passkey')?.addEventListener('click', async button => {
    const el = button.currentTarget; const error = document.querySelector('#security-error'); error.textContent = ''; el.disabled = true;
    try { await registerPasskey(); location.reload(); } catch (e) { error.textContent = e.message || 'Passkey registration failed.'; el.disabled = false; }
  });
  document.querySelectorAll('[data-rename]').forEach(button => button.addEventListener('click', async () => {
    const name = prompt('Passkey name', 'My device'); if (!name?.trim()) return;
    try { await renamePasskey(button.dataset.rename, name.trim()); location.reload(); } catch (e) { document.querySelector('#security-error').textContent = e.message || 'Unable to rename passkey.'; }
  }));
  document.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
    if (!confirm('Remove this passkey? You will no longer be able to use it to sign in.')) return;
    try { await deletePasskey(button.dataset.delete); location.reload(); } catch (e) { document.querySelector('#security-error').textContent = e.message || 'Unable to remove passkey.'; }
  }));
}
