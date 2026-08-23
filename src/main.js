import './style.css';
import { createClient } from '@supabase/supabase-js';
import { platformSettingsView, bindPlatformSettings } from './platform-settings.js';
import { loginView, bindLogin } from './login.js';

const fallback = { account:{initial_capital:30000000,cashout_realized:0,capital_deployed:17600000,capital_available:12400000,recovery_remaining:30000000,current_cycle:1}, positions:[], orders:[], candidates:[] };
const money=n=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n||0);
const num=n=>Number(n||0).toLocaleString('vi-VN');
const pct=(a,b)=>b?Math.round(a/b*100):0;
const routes=['/','/positions','/orders','/platforms'];
const route=()=>window.location.pathname.replace(/\/+$/,'')||'/';
const token=()=>localStorage.getItem('tce_access_token')||'';
const isAuthed=()=>Boolean(token());

async function load(){
  if(!isAuthed()){ render(fallback,'/login'); return; }
  let data=fallback;
  const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY;
  if(url&&key){try{const sb=createClient(url,key); const {data:a}=await sb.from('tce_accounts').select('*').eq('name','TCE-30M').single(); if(a){const [{data:p},{data:o},{data:c}]=await Promise.all([sb.from('tce_positions').select('*').eq('account_id',a.id).order('symbol'),sb.from('tce_orders').select('*').eq('account_id',a.id).order('created_at',{ascending:false}).limit(20),sb.from('tce_buy_candidates').select('*').eq('account_id',a.id).in('status',['queued','ready']).order('rank').limit(5)]); data={account:a,positions:p||[],orders:o||[],candidates:c||[]};}}catch(e){console.warn(e)}}
  window.__tceData=data;
  await render(data,route());
}

function positionsView(d){ const candidates=d.candidates||[]; return `<section class="section page-section"><div class="section-head"><div><h2>Positions</h2><small>Open positions</small></div><span>${d.positions.length}</span></div><div class="cards">${d.positions.length?d.positions.map(p=>`<div class="position"><div><b>${p.symbol}</b><small>${p.quantity} cp • avg ${num(p.avg_cost)}</small></div><div class="right"><b>${money(p.market_value||p.cost_basis)}</b><small class="${(p.unrealized_pnl||0)>=0?'up':'down'}">${(p.unrealized_pnl||0)>=0?'+':''}${money(p.unrealized_pnl||0)}</small></div></div>`).join(''):'<div class="empty">No open positions</div>'}</div></section><section class="section planned"><div class="section-head"><div><h2>Next 5 positions</h2><small>Planned buying candidates</small></div><span>${candidates.length}/5</span></div><div class="planned-list">${Array.from({length:5},(_,i)=>candidates[i]).map((c,i)=>c?`<div class="planned-row"><span class="slot">${c.rank}</span><div><b>${c.symbol}</b><small>${c.target_quantity?`${num(c.target_quantity)} cp`:''}${c.target_price?` • target ${num(c.target_price)}`:''}${c.reason?` • ${c.reason}`:''}</small></div><span class="planned-status ${c.status==='ready'?'ready':''}">${c.status}</span></div>`:`<div class="planned-row"><span class="slot">${i+1}</span><div><b>Position ${i+1}</b><small>Waiting for next buy candidate</small></div><span class="planned-status">Available</span></div>`).join('')}</div></section>`; }
function ordersView(d){ return `<section class="section page-section"><div class="section-head"><div><h2>Recent orders</h2><small>Latest 20 orders</small></div><span>${d.orders.length}</span></div><div class="orders">${d.orders.length?d.orders.map(o=>`<div class="order"><span class="badge ${o.side==='BUY'?'buy':'sell'}">${o.side}</span><b>${o.symbol}</b><span>${o.quantity} × ${num(o.price)}</span><strong>${money(o.gross_value)}</strong></div>`).join(''):'<div class="empty">No recent orders</div>'}</div></section>`; }
function overviewView(d){ const a=d.account; const deployed=a.capital_deployed||0, target=a.cashout_target||30000000, recovered=a.cashout_realized||0; return `<section class="hero"><div><span>Cashout progress</span><strong>${money(recovered)}</strong><small>mục tiêu ${money(target)}</small></div><div class="ring" style="--p:${pct(recovered,target)}%"><b>${pct(recovered,target)}%</b></div></section><section class="grid"><article><span>Vốn ban đầu</span><b>${money(a.initial_capital)}</b></article><article><span>Đang triển khai</span><b>${money(deployed)}</b></article><article><span>Cash khả dụng</span><b>${money(a.capital_available||0)}</b></article><article><span>Còn recover</span><b>${money(a.recovery_remaining||target)}</b></article></section><section class="section"><div class="section-head"><h2>Quick access</h2><span>Cycle ${a.current_cycle||1}</span></div><div class="quick-links"><button data-route="/positions"><b>${d.positions.length}</b><span>Positions</span></button><button data-route="/orders"><b>${d.orders.length}</b><span>Recent orders</span></button></div></section>`; }

async function render(d,path=route()){
  if(path==='/login'){ document.querySelector('#app').innerHTML=loginView(); bindLogin(); return; }
  if(!isAuthed()){ history.replaceState({},'', '/login'); document.querySelector('#app').innerHTML=loginView(); bindLogin(); return; }
  const page=path==='/positions'?positionsView(d):path==='/orders'?ordersView(d):path==='/platforms'?await platformSettingsView():overviewView(d);
  const active=path==='/'?0:path==='/positions'?1:path==='/orders'?2:3;
  document.querySelector('#app').innerHTML=`<main><header><div><span class="eyebrow">TCE • TREASURY CASH EXTRACTION</span><h1>${path==='/positions'?'Positions':path==='/orders'?'Recent orders':path==='/platforms'?'Trading Platforms':'Dashboard'}</h1></div><button class="live" id="logout">Sign out</button></header>${page}<nav>${[['⌂','Overview','/'],['◫','Positions','/positions'],['↕','Orders','/orders'],['⚙','Platforms','/platforms']].map(([icon,label,to],i)=>`<button class="${i===active?'active':''}" data-route="${to}">${icon}<small>${label}</small></button>`).join('')}</nav></main>`;
  document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.route)));
  document.querySelector('#logout')?.addEventListener('click',()=>{localStorage.removeItem('tce_access_token');localStorage.removeItem('tce_refresh_token');history.replaceState({},'', '/login');render(fallback,'/login');});
  if(path==='/platforms') bindPlatformSettings();
}
function navigate(to){ if(!routes.includes(to)) to='/'; history.pushState({},'',to); render(window.__tceData,route()); }
window.addEventListener('popstate',()=>render(window.__tceData,route()));
load();
