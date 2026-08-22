import './style.css';

console.log('[TCE][FE] staging deploy trigger');

const fallback = { account:{initial_capital:30000000,cashout_realized:0,capital_deployed:17600000,capital_available:12400000,recovery_remaining:30000000,current_cycle:1}, positions:[{symbol:'PTB',quantity:300,avg_cost:32,cost_basis:9600000,market_price:32,market_value:9600000,unrealized_pnl:0},{symbol:'SSI',quantity:400,avg_cost:20,cost_basis:8000000,market_price:20,market_value:8000000,unrealized_pnl:0}], orders:[{symbol:'PTB',side:'BUY',price:32,quantity:300,gross_value:9600000},{symbol:'SSI',side:'BUY',price:20,quantity:400,gross_value:8000000}]};
const money=n=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n);
const pct=(a,b)=>b?Math.round(a/b*100):0;

async function load(){
  let data=fallback;
  try {
    const response = await fetch('/api/dashboard', { credentials:'include' });
    if (response.ok) data = await response.json();
  } catch (e) { console.warn('BE unavailable; using fallback dashboard data', e); }
  render(data);
}
function render(d){
 const a=d.account, deployed=a.capital_deployed||0, target=a.cashout_target||30000000, recovered=a.cashout_realized||0;
 document.querySelector('#app').innerHTML=`<main><header><div><span class="eyebrow">TCE • TREASURY CASH EXTRACTION</span><h1>Dashboard</h1></div><span class="live">● MANUAL</span></header>
 <section class="hero"><div><span>Cashout progress</span><strong>${money(recovered)}</strong><small>mục tiêu ${money(target)}</small></div><div class="ring" style="--p:${pct(recovered,target)}%"><b>${pct(recovered,target)}%</b></div></section>
 <section class="grid"><article><span>Vốn ban đầu</span><b>${money(a.initial_capital)}</b></article><article><span>Đang triển khai</span><b>${money(deployed)}</b></article><article><span>Cash khả dụng</span><b>${money(a.capital_available||0)}</b></article><article><span>Còn recover</span><b>${money(a.recovery_remaining||target)}</b></article></section>
 <section class="section"><div class="section-head"><h2>Positions</h2><span>Cycle ${a.current_cycle||1}</span></div><div class="cards">${d.positions.map(p=>`<div class="position"><div><b>${p.symbol}</b><small>${p.quantity} cp • avg ${Number(p.avg_cost).toLocaleString('vi-VN')}</small></div><div class="right"><b>${money(p.market_value||p.cost_basis)}</b><small class="${(p.unrealized_pnl||0)>=0?'up':'down'}">${(p.unrealized_pnl||0)>=0?'+':''}${money(p.unrealized_pnl||0)}</small></div></div>`).join('')}</div></section>
 <section class="section"><div class="section-head"><h2>Recent orders</h2><span>${d.orders.length}</span></div><div class="orders">${d.orders.map(o=>`<div class="order"><span class="badge ${o.side==='BUY'?'buy':'sell'}">${o.side}</span><b>${o.symbol}</b><span>${o.quantity} × ${Number(o.price).toLocaleString('vi-VN')}</span><strong>${money(o.gross_value)}</strong></div>`).join('')}</div></section>
 <nav><button class="active">⌂<small>Overview</small></button><button>◫<small>Positions</small></button><button>↕<small>Orders</small></button><button>◷<small>Cycles</small></button></nav></main>`;
}
load();
