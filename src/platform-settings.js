const apiBase = import.meta.env.VITE_SERVICE_URL || '/api';

function esc(value) {
  return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
}

const providerFields = {
  ssi: [
    ['clientId', 'Client ID'], ['apiKey', 'API Key'], ['apiSecret', 'API Secret'],
    ['privateKey', 'Private Key'], ['accountNo', 'Account No.'], ['deviceId', 'Device ID']
  ],
  binance: [['apiKey', 'API Key'], ['apiSecret', 'API Secret']]
};

export async function platformSettingsView() {
  const token = localStorage.getItem('tce_access_token') || '';
  let saved = [];
  if (token) {
    try { saved = await fetch(`${apiBase}/platform/credentials`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []); } catch {}
  }
  const card = (provider, title, note) => {
    const item = saved.find(x => x.provider === provider && x.environment === (provider === 'binance' ? 'testnet' : 'production'));
    const fields = providerFields[provider].map(([key, label]) => `<label>${label}<input type="password" autocomplete="off" data-field="${key}" placeholder="${item ? '••••••••  saved' : 'Enter ' + label}" /></label>`).join('');
    return `<article class="platform-card"><div class="platform-title"><div><span class="eyebrow">${provider.toUpperCase()}</span><h2>${title}</h2><small>${note}</small></div><span class="status ${item ? 'connected' : ''}">${item ? '● CONNECTED' : '○ NOT CONNECTED'}</span></div><div class="platform-fields">${fields}</div><label>Environment<select data-env="${provider}">${provider === 'binance' ? '<option value="testnet">Testnet</option><option value="production">Production</option>' : '<option value="production">Production</option><option value="sandbox">Sandbox</option>'}</select></label><div class="platform-actions"><button class="secondary" data-test-provider="${provider}">Test connection</button><button class="primary" data-save-provider="${provider}">Save credentials</button></div></article>`;
  };
  return `<section class="section page-section"><div class="section-head"><div><span class="eyebrow">TRADING PLATFORM</span><h2>Connections</h2><small>Secrets are encrypted by the backend before storage.</small></div></div><div class="platform-grid">${card('ssi','SSI FastConnect','Vietnam equities • market data and trading')} ${card('binance','Binance','Spot / Futures • API credentials')}</div><div class="security-note"><b>Security</b><span>Credentials are never returned to the browser after saving. The service decrypts them only in memory when an external platform call is made.</span></div></section>`;
}

export function bindPlatformSettings() {
  document.querySelectorAll('[data-save-provider]').forEach(button => button.addEventListener('click', async () => {
    const provider = button.dataset.saveProvider;
    const card = button.closest('.platform-card');
    const credentials = Object.fromEntries([...card.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.value]).filter(([, value]) => value));
    if (!Object.keys(credentials).length) return alert('Enter at least one credential.');
    const environment = card.querySelector(`[data-env="${provider}"]`).value;
    const token = localStorage.getItem('tce_access_token');
    if (!token) return alert('Please login first.');
    button.disabled = true;
    try {
      const res = await fetch(`${apiBase}/platform/credentials/${provider}`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify({ environment, credentials }) });
      if (!res.ok) throw new Error(await res.text());
      alert(`${provider.toUpperCase()} credentials saved securely.`);
      location.reload();
    } catch (e) { alert(`Save failed: ${e.message}`); } finally { button.disabled = false; }
  }));
  document.querySelectorAll('[data-test-provider]').forEach(button => button.addEventListener('click', () => alert('Connection test will be wired to the platform adapter next.')));
}
