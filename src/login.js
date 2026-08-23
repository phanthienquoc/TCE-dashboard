const apiBase = import.meta.env.VITE_SERVICE_URL || '/api';

export function loginView() {
  return `<section class="auth-shell"><div class="auth-card"><span class="eyebrow">TCE • TREASURY CASH EXTRACTION</span><h1>Sign in</h1><p>Access your TCE trading workspace.</p><form id="login-form"><label>Email<input id="login-email" type="email" autocomplete="username" required></label><label>Password<input id="login-password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Sign in</button><div id="login-error" class="auth-error"></div></form></div></section>`;
}

export function bindLogin() {
  const form = document.querySelector('#login-form');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.querySelector('#login-error');
    error.textContent = '';
    try {
      const res = await fetch(`${apiBase}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email:document.querySelector('#login-email').value, password:document.querySelector('#login-password').value }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid credentials');
      if (data.mfaRequired) throw new Error('MFA is enabled for this account; use the existing MFA login flow.');
      localStorage.setItem('tce_access_token', data.accessToken);
      localStorage.setItem('tce_refresh_token', data.refreshToken);
      location.href = '/';
    } catch (e) { error.textContent = e.message; }
  });
}

export function clearSession() { localStorage.removeItem('tce_access_token'); localStorage.removeItem('tce_refresh_token'); }
