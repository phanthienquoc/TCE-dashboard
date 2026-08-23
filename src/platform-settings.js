const apiBase = import.meta.env.VITE_SERVICE_URL || '/api';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function esc(value) { return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }

const providerFields = {
  ssi: [['clientId','Client ID'],['apiKey','API Key'],['apiSecret','API Secret'],['privateKey','Private Key'],['accountNo','Account No.']],
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
  const card = (provider,title,note) => {
    const item=saved.find(x=>x.provider===provider);
    const fields=providerFields[provider].map(([key,label])=>`<label>${label}<input type="password" autocomplete="off" data-field="${key}" placeholder="${item?'••••••••  saved':'Enter '+label}" /></label>`).join('');
    const ssiAuth=provider==='ssi'?`<div class="ssi-auth-box"><b>Trading / 2FA</b><small>Market data only needs API Key + Secret. Portfolio sync and trading require a trading-capable token via OTP or Mobile Approval.</small><label>OTP <input type="password" inputmode="numeric" autocomplete="one-time-code" data-ssi-auth="otp" placeholder="Optional ••••••" /></label><label>Transaction ID <input type="text" autocomplete="off" data-ssi-auth="transactionId" placeholder="Optional Mobile Approval ID" /></label><div class="platform-actions"><button class="secondary" data-request-otp="ssi">Request OTP / Approval</button><button class="secondary" data-sync-provider="ssi">Sync Portfolio</button></div></div>`:'';
    return `<article class="platform-card is-collapsed" data-platform-card="${provider}"><div class="platform-title"><div><span class="eyebrow">${provider.toUpperCase()}</span><h2>${title}</h2><small>${note}</small></div><div class="platform-title-right"><span class="status ${item?'connected':''}">${item?'● CONFIGURED':'○ NOT CONFIGURED'}</span><button type="button" class="platform-collapse" data-platform-toggle="${provider}" aria-expanded="false" aria-label="Expand ${title}">⌄</button></div></div><div class="platform-body"><div class="platform-fields">${fields}</div><label>Environment<select data-env="${provider}">${provider==='binance'?'<option value="testnet">Testnet</option><option value="production">Production</option>':'<option value="production">Production</option>'}</select></label>${ssiAuth}<div class="platform-actions"><button class="secondary" data-test-provider="${provider}">Test connection</button><button class="primary" data-save-provider="${provider}">Save credentials</button></div></div></article>`;
  };
  return `<section class="section page-section"><div class="section-head"><div><span class="eyebrow">TRADING PLATFORM</span><h2>Connections</h2><small>SSI FastConnect v3 • credentials are encrypted by the backend and never returned to the browser.</small></div></div><div class="platform-grid">${card('ssi','SSI FastConnect','Production REST API • market data + portfolio sync + trading auth')}${card('binance','Binance','Spot / Futures • API credentials')}</div><div class="security-note"><b>SSI live connection</b><span>Portfolio Sync reads the configured SSI account, imports current equity positions and today’s orders into TCE, and updates existing records. OTP / transactionId is used transiently and is never stored.</span></div></section>`;
}

export function bindPlatformSettings() {
  document.querySelectorAll('[data-platform-toggle]').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('[data-platform-card]');const expanded=card.classList.toggle('is-collapsed');button.setAttribute('aria-expanded',String(!expanded));button.textContent=expanded?'⌄':'⌃';}));

  document.querySelectorAll('[data-save-provider]').forEach(button=>button.addEventListener('click',async()=>{
    const provider=button.dataset.saveProvider,card=button.closest('.platform-card'),credentials=Object.fromEntries([...card.querySelectorAll('[data-field]')].map(i=>[i.dataset.field,i.value]).filter(([,v])=>v)),environment=card.querySelector(`[data-env="${provider}"]`).value,authorization=await authHeader();
    if(!Object.keys(credentials).length)return alert('Enter at least one credential.');
    if(!authorization)return alert('Please login first.');
    button.disabled=true;
    try{const res=await fetch(`${apiBase}/platform/credentials/${provider}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization},body:JSON.stringify({environment,credentials})});if(!res.ok)throw new Error(await res.text());alert(`${provider.toUpperCase()} credentials saved securely.`);location.reload();}catch(e){alert(`Save failed: ${e.message}`);}finally{button.disabled=false;}
  }));

  document.querySelectorAll('[data-request-otp]').forEach(button=>button.addEventListener('click',async()=>{
    const provider=button.dataset.requestOtp,card=button.closest('.platform-card'),environment=card.querySelector(`[data-env="${provider}"]`).value,authorization=await authHeader();
    if(!authorization)return alert('Please login first.');
    button.disabled=true;
    try{const res=await fetch(`${apiBase}/platform/credentials/${provider}/request-otp`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization},body:JSON.stringify({environment})});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.message||body.msg||'OTP request failed');if(body.transactionId){const input=card.querySelector('[data-ssi-auth="transactionId"]');if(input)input.value=body.transactionId;}alert(body.message||'SSI approval/OTP request sent.');}catch(e){alert(`SSI OTP request failed: ${e.message}`);}finally{button.disabled=false;}
  }));

  document.querySelectorAll('[data-sync-provider]').forEach(button=>button.addEventListener('click',async()=>{
    const provider=button.dataset.syncProvider,card=button.closest('.platform-card'),environment=card.querySelector(`[data-env="${provider}"]`).value,authorization=await authHeader();
    if(!authorization)return alert('Please login first.');
    const body={environment};
    if(provider==='ssi'){body.otp=card.querySelector('[data-ssi-auth="otp"]')?.value||undefined;body.transactionId=card.querySelector('[data-ssi-auth="transactionId"]')?.value||undefined;}
    button.disabled=true;
    try{const res=await fetch(`${apiBase}/platform/credentials/${provider}/sync`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization},body:JSON.stringify(body)});const result=await res.json().catch(()=>({}));if(!res.ok)throw new Error(result.message||result.msg||'Portfolio sync failed');alert(`SSI connected • ${result.accountNo} • ${result.positionsSynced} positions • ${result.ordersSynced} orders synced`);location.reload();}catch(e){alert(`SSI sync failed: ${e.message}`);}finally{button.disabled=false;}
  }));

  document.querySelectorAll('[data-test-provider]').forEach(button=>button.addEventListener('click',async()=>{
    const provider=button.dataset.testProvider,card=button.closest('.platform-card'),environment=card.querySelector(`[data-env="${provider}"]`).value,authorization=await authHeader();
    if(!authorization)return alert('Please login first.');
    const body={environment};
    if(provider==='ssi'){body.otp=card.querySelector('[data-ssi-auth="otp"]')?.value||undefined;body.transactionId=card.querySelector('[data-ssi-auth="transactionId"]')?.value||undefined;}
    button.disabled=true;
    try{const res=await fetch(`${apiBase}/platform/credentials/${provider}/test`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization},body:JSON.stringify(body)});const result=await res.json().catch(()=>({}));if(!res.ok)throw new Error(result.message||result.msg||'Connection test failed');alert(`${provider.toUpperCase()} connected • auth OK • market data OK${result.rateLimit?.remaining?` • ${result.rateLimit.remaining} requests remaining`:''}`);}catch(e){alert(`Connection test failed: ${e.message}`);}finally{button.disabled=false;}
  }));
}
