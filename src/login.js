const apiBase = import.meta.env.VITE_SERVICE_URL || '/api';

export function loginView() {
  return `<section class="auth-shell"><div class="auth-glow"></div><div class="auth-brand"><div class="brand-mark">T</div><div><span class="eyebrow">TCE</span><b>Treasury Cash Extraction</b></div></div><div class="auth-card"><div class="auth-header"><span class="auth-kicker">WELCOME BACK</span><h1>Sign in</h1><p>Access your trading workspace securely.</p></div><form id="login-form"><label>Email<input id="login-email" type="email" autocomplete="username" placeholder="you@example.com" required></label><label>Password<div class="password-wrap"><input id="login-password" type="password" autocomplete="current-password" placeholder="Enter your password" required><button type="button" class="password-toggle" id="toggle-password" aria-label="Show password">Show</button></div></label><div class="auth-options"><label class="remember"><input id="remember-me" type="checkbox"> <span>Remember me</span></label><span class="secure-badge">● Secure session</span></div><button class="auth-submit" type="submit"><span>Sign in</span><span>→</span></button><button class="passkey-submit" id="passkey-login" type="button" disabled title="Backend Passkey flow is not enabled yet"><span>⌁</span><span>Passkey — coming soon</span></button><div id="login-error" class="auth-error" role="alert"></div></form><div class="auth-footer"><span>Protected TCE workspace</span><span>•</span><span>Backend authenticated</span></div></div></section>`;
}

function saveSession(session) {
  if (!session?.accessToken) throw new Error('No access token returned');
  localStorage.setItem('tce_access_token', session.accessToken);
  if (session.refreshToken) localStorage.setItem('tce_refresh_token', session.refreshToken);
}
function showError(message) { const el = document.querySelector('#login-error'); if (el) el.textContent = message; }

export function bindLogin() {
  const form = document.querySelector('#login-form');
  if (!form) return;
  document.querySelector('#toggle-password')?.addEventListener('click', () => { const input = document.querySelector('#login-password'); const button = document.querySelector('#toggle-password'); const visible = input.type === 'text'; input.type = visible ? 'password' : 'text'; button.textContent = visible ? 'Show' : 'Hide'; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('.auth-submit');
    submit.disabled = true; submit.classList.add('loading'); showError('');
    try {
      const email = document.querySelector('#login-email').value.trim();
      const password = document.querySelector('#login-password').value;
      const response = await fetch(`${apiBase}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({ email, password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Invalid credentials');
      if (data.mfaRequired) throw new Error('MFA verification is required for this account.');
      saveSession(data);
      location.href = '/';
    } catch (error) {
      showError(error.message || 'Unable to sign in. Please try again.');
      submit.disabled = false; submit.classList.remove('loading');
    }
  });
}

export function clearSession() {
  localStorage.removeItem('tce_access_token');
  localStorage.removeItem('tce_refresh_token');
}
