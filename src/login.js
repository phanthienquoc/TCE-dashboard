const apiBase = import.meta.env.VITE_SERVICE_URL || '/api';

export function loginView() {
  return `<section class="auth-shell"><div class="auth-glow"></div><div class="auth-brand"><div class="brand-mark">T</div><div><span class="eyebrow">TCE</span><b>Treasury Cash Extraction</b></div></div><div class="auth-card"><div class="auth-header"><span class="auth-kicker">WELCOME BACK</span><h1>Sign in</h1><p>Access your trading workspace securely.</p></div><form id="login-form"><label>Email<input id="login-email" type="email" autocomplete="username" placeholder="you@example.com" required></label><label>Password<div class="password-wrap"><input id="login-password" type="password" autocomplete="current-password" placeholder="Enter your password" required><button type="button" class="password-toggle" id="toggle-password" aria-label="Show password">Show</button></div></label><div class="auth-options"><label class="remember"><input id="remember-me" type="checkbox"> <span>Remember me</span></label><span class="secure-badge">● Secure session</span></div><button class="auth-submit" type="submit"><span>Sign in</span><span>→</span></button><div id="login-error" class="auth-error" role="alert"></div></form><div class="auth-footer"><span>Protected TCE workspace</span><span>•</span><span>Encrypted credentials</span></div></div></section>`;
}

export function bindLogin() {
  const form = document.querySelector('#login-form');
  if (!form) return;
  document.querySelector('#toggle-password')?.addEventListener('click', () => {
    const input = document.querySelector('#login-password');
    const button = document.querySelector('#toggle-password');
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    button.textContent = visible ? 'Show' : 'Hide';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.querySelector('#login-error');
    const submit = form.querySelector('.auth-submit');
    error.textContent = '';
    submit.disabled = true;
    submit.classList.add('loading');
    try {
      const res = await fetch(`${apiBase}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email:document.querySelector('#login-email').value.trim(), password:document.querySelector('#login-password').value }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid email or password');
      if (data.mfaRequired) throw new Error('MFA is enabled for this account; use the MFA verification flow.');
      localStorage.setItem('tce_access_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('tce_refresh_token', data.refreshToken);
      location.href = '/';
    } catch (e) { error.textContent = e.message || 'Unable to sign in. Please try again.'; submit.disabled = false; submit.classList.remove('loading'); }
  });
}

export function clearSession() { localStorage.removeItem('tce_access_token'); localStorage.removeItem('tce_refresh_token'); }
