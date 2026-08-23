import { createClient } from '@supabase/supabase-js';

const apiBase = import.meta.env.VITE_SERVICE_URL || '/api';
// Supabase publishable keys are safe to ship to the browser. Keep secrets/service-role keys server-side.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gtqovpusfyyvxpeezxlo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_xlyvAjzfIW58q2R_d7LPfw_qM8DLA7W';
export const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, experimental: { passkey: true } } });

const passkeySupported = () => Boolean(window.isSecureContext && window.PublicKeyCredential && typeof supabase.auth.signInWithPasskey === 'function');

export function loginView() {
  return `<section class="auth-shell"><div class="auth-glow"></div><div class="auth-brand"><div class="brand-mark">T</div><div><span class="eyebrow">TCE</span><b>Treasury Cash Extraction</b></div></div><div class="auth-card"><div class="auth-header"><span class="auth-kicker">WELCOME BACK</span><h1>Sign in</h1><p>Access your trading workspace securely.</p></div><form id="login-form"><label>Email<input id="login-email" type="email" autocomplete="username webauthn" placeholder="you@example.com" required></label><label>Password<div class="password-wrap"><input id="login-password" type="password" autocomplete="current-password" placeholder="Enter your password" required><button type="button" class="password-toggle" id="toggle-password" aria-label="Show password">Show</button></div></label><div class="auth-options"><label class="remember"><input id="remember-me" type="checkbox"> <span>Remember me</span></label><span class="secure-badge">● Secure session</span></div><button class="auth-submit" type="submit"><span>Sign in</span><span>→</span></button><button class="passkey-submit" id="passkey-login" type="button" ${passkeySupported() ? '' : 'hidden'}><span>⌁</span><span>Sign in with Passkey</span></button><div id="login-error" class="auth-error" role="alert"></div></form><div class="auth-footer"><span>Protected TCE workspace</span><span>•</span><span>Passkey protected</span></div></div></section>`;
}

function saveSession(session) { if (!session?.access_token) throw new Error('No access token returned'); localStorage.setItem('tce_access_token', session.access_token); if (session.refresh_token) localStorage.setItem('tce_refresh_token', session.refresh_token); }
function showError(message) { const el = document.querySelector('#login-error'); if (el) el.textContent = message; }

export function bindLogin() {
  const form = document.querySelector('#login-form'); if (!form) return;
  document.querySelector('#toggle-password')?.addEventListener('click', () => { const input = document.querySelector('#login-password'); const button = document.querySelector('#toggle-password'); const visible = input.type === 'text'; input.type = visible ? 'password' : 'text'; button.textContent = visible ? 'Show' : 'Hide'; });
  form.addEventListener('submit', async event => { event.preventDefault(); const submit = form.querySelector('.auth-submit'); submit.disabled = true; submit.classList.add('loading'); showError(''); try { const email = document.querySelector('#login-email').value.trim(); const password = document.querySelector('#login-password').value; const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; saveSession(data.session); location.href = '/'; } catch (error) { showError(error.message || 'Unable to sign in. Please try again.'); submit.disabled = false; submit.classList.remove('loading'); } });
  document.querySelector('#passkey-login')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; showError(''); try { if (!window.isSecureContext) throw new Error('Passkey requires HTTPS. Open the secure HTTPS address.'); if (!passkeySupported()) throw new Error('Passkey is not available on this browser.'); const { data, error } = await supabase.auth.signInWithPasskey(); if (error) throw error; saveSession(data.session); location.href = '/'; } catch (error) { showError(error.message || 'Passkey sign-in failed.'); button.disabled = false; } });
}

export async function registerPasskey() { if (!window.isSecureContext) throw new Error('Passkey requires HTTPS.'); if (typeof supabase.auth.registerPasskey !== 'function') throw new Error('Passkey enrollment is unavailable.'); const { data, error } = await supabase.auth.registerPasskey(); if (error) throw error; return data; }
export async function listPasskeys() { const { data, error } = await supabase.auth.passkey.list(); if (error) throw error; return data || []; }
export async function renamePasskey(passkeyId, friendlyName) { const { data, error } = await supabase.auth.passkey.update({ passkeyId, friendlyName }); if (error) throw error; return data; }
export async function deletePasskey(passkeyId) { const { error } = await supabase.auth.passkey.delete({ passkeyId }); if (error) throw error; }
export function clearSession() { localStorage.removeItem('tce_access_token'); localStorage.removeItem('tce_refresh_token'); supabase.auth.signOut().catch(() => {}); }
