const apiBase = import.meta.env.VITE_SERVICE_URL || '/api';
const token = () => localStorage.getItem('tce_access_token') || '';

export function platformConfigView() {
  return `<section class="section page-section"><div class="section-head"><div><span class="eyebrow">PLATFORM CONFIG</span><h2>FastAPI & Binance</h2><small>Configure market-data endpoints and trading credentials.</small></div></div><div class="platform-grid"><article class="platform-card"><div class="platform-title"><div><span class="eyebrow">FASTAPI</span><h2>Market Data API</h2><small>Internal TCE service endpoint</small></div></div><label>Base URL<input id="fastapi-base-url" type="url" placeholder="https://api.example.com"></label><label>Health path<input id="fastapi-health-path" type="text" value="/health"></label><button class="primary" id="save-fastapi-config">Save FastAPI config</button><div id="fastapi-status" class="security-note"></div></article><article class="platform-card"><div class="platform-title"><div><span class="eyebrow">BINANCE</span><h2>API Credentials</h2><small>Credentials are encrypted before storage.</small></div></div><label>Environment<select id="binance-environment"><option value="testnet">Testnet</option><option value="production">Production</option></select></label><label>API Key<input id="binance-api-key" type="password" autocomplete="off"></label><label>API Secret<input id="binance-api-secret" type="password" autocomplete="off"></label><button class="primary" id="save-binance-config">Save Binance config</button><div id="binance-status" class="security-note"></div></article></div></section>`;
}

export function bindPlatformConfig() {
  document.querySelector('#save-fastapi-config')?.addEventListener('click', async () => {
    const baseUrl = document.querySelector('#fastapi-base-url').value.trim();
    const healthPath = document.querySelector('#fastapi-health-path').value.trim() || '/health';
    if (!baseUrl) return;
    const box = document.querySelector('#fastapi-status');
    try {
      const res = await fetch(`${apiBase}/platform/config/fastapi`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token()}`}, body:JSON.stringify({ baseUrl, healthPath }) });
      if (!res.ok) throw new Error(await res.text());
      box.textContent = 'FastAPI config saved.';
    } catch (e) { box.textContent = `Save failed: ${e.message}`; }
  });
  document.querySelector('#save-binance-config')?.addEventListener('click', async () => {
    const apiKey = document.querySelector('#binance-api-key').value.trim();
    const apiSecret = document.querySelector('#binance-api-secret').value.trim();
    const environment = document.querySelector('#binance-environment').value;
    if (!apiKey || !apiSecret) return;
    const box = document.querySelector('#binance-status');
    try {
      const res = await fetch(`${apiBase}/platform/credentials/binance`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token()}`}, body:JSON.stringify({ environment, credentials:{ apiKey, apiSecret } }) });
      if (!res.ok) throw new Error(await res.text());
      box.textContent = 'Binance credentials saved securely.';
      document.querySelector('#binance-api-key').value = '';
      document.querySelector('#binance-api-secret').value = '';
    } catch (e) { box.textContent = `Save failed: ${e.message}`; }
  });
}
