const apiBase = import.meta.env.VITE_SERVICE_URL || '/api';
const token = () => localStorage.getItem('tce_access_token') || '';

export async function platformConfigView() {
  let fastapi = null;
  let credentials = [];
  try {
    const headers = { Authorization: `Bearer ${token()}` };
    fastapi = await fetch(`${apiBase}/platform/config/fastapi`, { headers }).then(r => r.ok ? r.json() : null);
    credentials = await fetch(`${apiBase}/platform/credentials`, { headers }).then(r => r.ok ? r.json() : []);
  } catch {}
  const binance = credentials.find(x => x.provider === 'binance');
  return `<section class="section page-section"><div class="section-head"><div><span class="eyebrow">PLATFORM CONFIG</span><h2>FastAPI & Binance</h2><small>Configure endpoints and encrypted exchange credentials.</small></div></div><div class="platform-grid"><article class="platform-card"><div class="platform-title"><div><span class="eyebrow">FASTAPI</span><h2>Market Data API</h2><small>Internal TCE market-data service</small></div><span class="status ${fastapi?.config?'connected':''}">${fastapi?.config?'● CONFIGURED':'○ NOT CONFIGURED'}</span></div><label>Base URL<input id="fastapi-base-url" type="url" value="${fastapi?.config?.baseUrl ?? ''}" placeholder="https://market-data.example.com"></label><label>Health path<input id="fastapi-health-path" type="text" value="${fastapi?.config?.healthPath ?? '/health'}"></label><button class="primary" id="save-fastapi-config">Save FastAPI config</button><div id="fastapi-status" class="security-note"></div></article><article class="platform-card"><div class="platform-title"><div><span class="eyebrow">BINANCE</span><h2>API Credentials</h2><small>${binance ? 'Credentials configured' : 'Not configured'}</small></div><span class="status ${binance?'connected':''}">${binance?'● CONNECTED':'○ NOT CONNECTED'}</span></div><label>Environment<select id="binance-environment"><option value="testnet">Testnet</option><option value="production">Production</option></select></label><label>API Key<input id="binance-api-key" type="password" autocomplete="off" placeholder="Enter API key"></label><label>API Secret<input id="binance-api-secret" type="password" autocomplete="off" placeholder="Enter API secret"></label><button class="primary" id="save-binance-config">Save Binance credentials</button><div id="binance-status" class="security-note">Secrets are encrypted server-side and never returned to the browser.</div></article></div></section>`;
}

export function bindPlatformConfig() {
  document.querySelector('#save-fastapi-config')?.addEventListener('click', async () => {
    const box = document.querySelector('#fastapi-status');
    try {
      const body = { baseUrl: document.querySelector('#fastapi-base-url').value.trim(), healthPath: document.querySelector('#fastapi-health-path').value.trim() || '/health' };
      if (!body.baseUrl) throw new Error('Base URL is required');
      const res = await fetch(`${apiBase}/platform/config/fastapi`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token()}`}, body:JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      box.textContent = 'FastAPI config saved.';
    } catch (e) { box.textContent = `Save failed: ${e.message}`; }
  });
  document.querySelector('#save-binance-config')?.addEventListener('click', async () => {
    const box = document.querySelector('#binance-status');
    try {
      const apiKey = document.querySelector('#binance-api-key').value.trim();
      const apiSecret = document.querySelector('#binance-api-secret').value.trim();
      if (!apiKey || !apiSecret) throw new Error('Both API key and API secret are required');
      const environment = document.querySelector('#binance-environment').value;
      const res = await fetch(`${apiBase}/platform/credentials/binance`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token()}`}, body:JSON.stringify({ environment, credentials:{ apiKey, apiSecret } }) });
      if (!res.ok) throw new Error(await res.text());
      box.textContent = 'Binance credentials saved securely.';
      document.querySelector('#binance-api-key').value='';
      document.querySelector('#binance-api-secret').value='';
    } catch (e) { box.textContent = `Save failed: ${e.message}`; }
  });
}
