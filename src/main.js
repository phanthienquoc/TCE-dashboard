import './style.css';
import { createClient } from '@supabase/supabase-js';

const fallback = { account:{initial_capital:30000000,cashout_realized:0,capital_deployed:17600000,capital_available:12400000,recovery_remaining:30000000,current_cycle:1}, positions:[{symbol:'PTB',quantity:300,avg_cost:32,cost_basis:9600000,market_price:32,market_value:9600000,unrealized_pnl:0},{symbol:'SSI',quantity:400,avg_cost:20,cost_basis:8000000,market_price:20,market_value:8000000,unrealized_pnl:0}], orders:[{symbol:'PTB',side:'BUY',price:32,quantity:300,gross_value:9600000},{symbol:'SSI',side:'BUY',price:20,quantity:400,gross_value:8000000}]};
const money=n=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n);
const pct=(a,b)=>b?Math.round(a/b*100):0;
const routes=['/','/positions','/orders'];
const route=()=>window.location.pathname.replace(/\/+$/,'')||'/';

async function load(){
  let data=fallback;
  if(url&&key){try{const sb=createClient(url,key); const {data:a}=await sb.from('tce_accounts').select('*').eq('name','TCE-30M').single(); const {data:p}=await sb.from('tce_positions').select('*').eq('account_id',a.id).order('symbol'); const {data:o}=await sb.from('tce_orders').select('*').eq('account_id',a.id).order('created_at',{ascending:false}).limit(20); if(a)data={account:a,positions:p||[],orders:o||[]};}catch(e){console.warn(e)}}
  window.__tceData=data;
  render(data,route());
}

function positionsView(d){
  const slots=Array.from({length:5},(_,i)=>d.positions[i]||null);
  return `<section class="section page-section"><div class="section-head"><div><h2>Positions</h2><small>Open positions</small></div><span>${d.positions.length}</span></div><div class="cards">${d.positions.length?d.positions.map(p=>`<div class="position"><div><b>${p.symbol}</b><small>${p.quantity} cp • avg ${Number(p.avg_cost).toLocaleString('vi-VN')}</small></div><div class="right"><b>${money(p.market_value||p.cost_basis)}</b><small class="${(p.unrealized_pnl||0)>=0?'up':'down'}">${(p.unrealized_pnl||0)>=0?'+':''}${money(p.unrealized_pnl||0)}</small></div></div>`).join(''):'<div class="empty">No open positions</div>'}</div></section>
  <section class="section planned"><div class="section-head"><div><h2>Next 5 positions</h2><small>Planned buying slots</small></div><span>5 slots</span></div><div class="planned-list">${slots.map((p,i)=>p?`<div class="planned-row"><span class="slot">${i+1}</span><div><b>${p.symbol}</b><small>Current position</small></div><span class="planned-status occupied">Occupied</span></div>`:`<div class="planned-row"><span class="slot">${i+1}</span><div><b>Position ${i+1}</b><small>Waiting for next buy candidate</small></div><span class="planned-status">Available</span></div>`).join('')}</div></section>`;
}

function ordersView(d){
  return `<section class="section page-section"><div class="section-head"><div><h2>Recent orders</h2><small>Latest 20 orders</small></div><span>${d.orders.length}</span></div><div class="orders">${d.orders.length?d.orders.map(o=>`<div class="order"><span class="badge ${o.side==='BUY'?'buy':'sell'}">${o.side}</span><b>${o.symbol}</b><span>${o.quantity} × ${Number(o.price).toLocaleString('vi-VN')}</span><strong>${money(o.gross_value)}</strong></div>`).join(''):'<div class="empty">No recent orders</div>'}</div></section>`;
}

function overviewView(d){
  const a=d.account, deployed=a.capital_deployed||0, target=a.cashout_target||30000000, recovered=a.cashout_realized||0;
  return `<section class="hero"><div><span>Cashout progress</span><strong>${money(recovered)}</strong><small>mục tiêu ${money(target)}</small></div><div class="ring" style="--p:${pct(recovered,target)}%"><b>${pct(recovered,target)}%</b></div></section>
  <section class="grid"><article><span>Vốn ban đầu</span><b>${money(a.initial_capital)}</b></article><article><span>Đang triển khai</span><b>${money(deployed)}</b></article><article><span>Cash khả dụng</span><b>${money(a.capital_available||0)}</b></article><article><span>Còn recover</span><b>${money(a.recovery_remaining||target)}</b></article></section>
  <section class="section"><div class="section-head"><h2>Quick access</h2><span>Cycle ${a.current_cycle||1}</span></div><div class="quick-links"><button data-route="/positions"><b>${d.positions.length}</b><span>Positions</span></button><button data-route="/orders"><b>${d.orders.length}</b><span>Recent orders</span></button></div></section>`;
}

function render(d,path=route()){
  const page=path==='/positions'?positionsView(d):path==='/orders'?ordersView(d):overviewView(d);
  const active=path==='/'?0:path==='/positions'?1:2;
  document.querySelector('#app').innerHTML=`<main><header><div><span class="eyebrow">TCE • TREASURY CASH EXTRACTION</span><h1>${path==='/positions'?'Positions':path==='/orders'?'Recent orders':'Dashboard'}</h1></div><span class="live">● MANUAL</span></header>${page}<nav>${[['⌂','Overview','/'],['◫','Positions','/positions'],['↕','Orders','/orders'],['◷','Cycles','#']].map(([icon,label,to],i)=>`<button class="${i===active?'active':''}" data-route="${to}">${icon}<small>${label}</small></button>`).join('')}</nav></main>`;
  document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.route)));
}

function navigate(to){
  if(to==='#') return;
  if(!routes.includes(to)) to='/';
  history.pushState({},'',to);
  render(window.__tceData,route());
}

window.addEventListener('popstate',()=>render(window.__tceData,route()));
load();
