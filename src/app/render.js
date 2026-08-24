import { platformSettingsView, bindPlatformSettings } from '../platform-settings.js';
import { loginView, bindLogin } from '../login.js';
import { signupView, bindSignup } from '../signup.js';
import { securityView, bindSecurity } from '../security.js';
import { entryModal, bindEntryModal } from '../components/entry-modal.js';
import { backendBanner } from '../components/backend-status.js';
import { clearSession, hasSession } from '../lib/session.js';
import { fallbackDashboard } from '../lib/api/dashboard.js';
import { currentRoute } from './router.js';
import { overviewView } from '../views/overview.js';
import { positionsView, bindPositionActions } from '../views/positions.js';
import { ordersView } from '../views/orders.js';

const titles = {
  '/': 'Dashboard',
  '/positions': 'Positions',
  '/orders': 'Recent orders',
  '/platforms': 'Trading Platforms',
  '/security': 'Security',
};

const navItems = [
  ['⌂', 'Overview', '/'],
  ['◫', 'Positions', '/positions'],
  ['↕', 'Orders', '/orders'],
  ['⚙', 'Platforms', '/platforms'],
  ['◉', 'Security', '/security'],
];

function pageFor(data, path) {
  if (path === '/positions') return positionsView(data);
  if (path === '/orders') return ordersView(data);
  if (path === '/platforms') return platformSettingsView();
  if (path === '/security') return securityView();
  return overviewView(data);
}

function shell(data, path, page) {
  const active = navItems.findIndex(([, , route]) => route === path);
  return `${backendBanner(window.__tceBackendStatus)}<main><header><div><span class="eyebrow">TCE • TREASURY CASH EXTRACTION</span><h1>${titles[path] || titles['/']}</h1></div><button class="live" id="logout">Sign out</button></header>${page}${entryModal()}<nav>${navItems.map(([icon, label, route], index) => `<button class="${index === active ? 'active' : ''}" data-route="${route}">${icon}<small>${label}</small></button>`).join('')}</nav></main>`;
}

export async function render(data = window.__tceData || fallbackDashboard, path = currentRoute()) {
  const app = document.querySelector('#app');
  if (!app) return;

  if (path === '/login') {
    app.innerHTML = `${backendBanner(window.__tceBackendStatus)}${loginView()}`;
    bindLogin();
    return;
  }

  if (path === '/signup') {
    app.innerHTML = `${backendBanner(window.__tceBackendStatus)}${signupView()}`;
    bindSignup();
    return;
  }

  if (!hasSession()) {
    history.replaceState({}, '', '/login');
    app.innerHTML = `${backendBanner(window.__tceBackendStatus)}${loginView()}`;
    bindLogin();
    return;
  }

  const page = await pageFor(data, path);
  app.innerHTML = shell(data, path, page);

  document.querySelector('#logout')?.addEventListener('click', () => {
    clearSession();
    history.replaceState({}, '', '/login');
    render(fallbackDashboard, '/login');
  });

  document.querySelectorAll('[data-position-toggle]').forEach((element) => element.addEventListener('click', () => element.closest('.position-wrap')?.classList.toggle('expanded')));
  bindPositionActions();
  bindEntryModal();
  if (path === '/platforms') bindPlatformSettings();
  if (path === '/security') bindSecurity();
}
