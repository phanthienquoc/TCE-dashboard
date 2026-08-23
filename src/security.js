const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

export async function securityView() {
  return `<section class="section page-section"><div class="section-head"><div><span class="eyebrow">ACCOUNT SECURITY</span><h2>Passkeys</h2><small>Passwordless login will be handled by the TCE backend.</small></div><span class="status">BACKEND</span></div><div class="security-card"><div class="security-hero"><div class="security-icon">⌁</div><div><b>Passkey authentication</b><span>The frontend no longer talks directly to Supabase Auth. Backend WebAuthn endpoints will own registration, verification and credential storage.</span></div></div><button class="security-primary" id="add-passkey" disabled title="Backend WebAuthn endpoints are not enabled yet">＋ Add this device</button><div id="security-error" class="auth-error"></div><div class="empty">Passkey enrollment is pending the backend WebAuthn endpoint.</div></div></section>`;
}

export function bindSecurity() {
  document.querySelector('#add-passkey')?.addEventListener('click', () => {
    document.querySelector('#security-error').textContent = 'Backend Passkey flow is not enabled yet.';
  });
}
