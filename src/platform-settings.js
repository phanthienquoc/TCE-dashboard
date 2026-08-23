const apiBase = import.meta.env.VITE_SERVICE_URL || '/api';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function esc(value) { return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }

const providerFields = {
  ssi: [['clientId','Client ID'],['apiKey','API Key'],['apiSecret','API Secret'],['privateKey','Private Key'],['accountNo','Account No.'],['deviceId','Device ID']],
  binance: [['apiKey','API Key'],['apiSecret','API Secret']]
};

async function authHeader() {
  if (supabaseUrl && supabaseAnonKey) {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await sb.auth.getSession();
    if (data.session?.access_token) return `Bearer ${data.session.access_token}`;
  }
  const token = localStorage.getItem('tce_access_token') || '';
  return token ? `Bearer ${token}` : '';
}

export async function platformSettingsView() {
  const authorization = await authHeader(); let saved = [];
  if (authorization) { try { saved = await fetch(`${apiBase}/platform/credentials`, { headers:{Authorization:authorization} }).then(r => r.ok ? r.json() : []); } catch {} }
  const card = (provider,title,note) => { const item=saved.find(x=>x.provider===provider); const fields=providerFields[provider].map(([key,label])=>`<label>${label}<input type="password" autocomplete="off" data-field="${key}" placeholder="${item?'••••••••  saved':'Enter '+label}" /></label>`).join(''); return `<article class="platform-card is-collapsed" data-platform-card="${provider}"><div class="platform-title"><div><span class="eyebrow">${provider.toUpperCase()}</span><h2>${title}</h2><small>${note}</small></div><div class="platform-title-right"><span class="status ${item?'connected':''}">${item?'● CONNECTED':'○ NOT CONNECTED'}</span><button type="button" class="platform-collapse" data-platform-toggle="${provider}" aria-expanded="false" aria-label="Expand ${title}">⌄</button></div></div><div class="platform-body"><div class="platform-fields">${fields}</div><label>Environment<select data-env="${provider}">${provider==='binance'?'<option value="testnet">Testnet</option><option value="production">Production</option>':'<option value="production">Production</option><option value="sandbox">Sandbox</option>'}</select></label><div class="platform-actions"><button class="secondary" data-test-provider="${provider}">Test connection</button><button class="primary" data-save-provider="${provider}">Save credentials</button></div></div></article>`; };
  return `<section class="section page-section"><div class="section-head"><div><span class="eyebrow">TRADING PLATFORM</span><h2>Connections</h2><small>Secrets are encrypted by the backend before storage.</small></div></div><div class="platform-grid">${card('ssi','SSI FastConnect','Vietnam equities • market data and trading')}${card('binance','Binance','Spot / Futures • API credentials')}</div><div class="security-note"><b>Security</b><span>Credentials are never returned to the browser after saving. The service decrypts them only in memory when an external platform call is made.</span></div></section>`;
}

export function bindPlatformSettings() {
  document.querySelectorAll('[data-platform-toggle]').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('[data-platform-card]');const expanded=card.classList.toggle('is-collapsed');button.setAttribute('aria-expanded',String(!expanded));button.textContent=expanded?'⌄':'⌃';}));
  document.querySelectorAll('[data-save-provider]').forEach(button=>button.addEventListener('click',async()=>{const provider=button.dataset.saveProvider,card=button.closest('.platform-card'),credentials=Object.fromEntries([...card.querySelectorAll('[data-field]')].map(i=>[i.dataset.field,i.value]).filter(([,v])=>v)),environment=card.querySelector(`[data-env="${provider}"]`).value,authorization=await authHeader();if(!Object.keys(credentials).length)return alert('Enter at least one credential.');if(!authorization)return alert('Please login first.');button.disabled=true;try{const res=await fetch(`${apiBase}/platform/credentials/${provider}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization},body:JSON.stringify({environment,credentials})});if(!res.ok)throw new Error(await res.text());alert(`${provider.toUpperCase()} credentials saved securely.`);location.reload();}catch(e){alert(`Save failed: ${e.message}`);}finally{button.disabled=false;}}));
  document.querySelectorAll('[data-test-provider]').forEach(button=>button.addEventListener('click',()=>alert('Connection test will be wired to the platform adapter next.')));
}
