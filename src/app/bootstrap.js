import { checkBackend, fallbackDashboard, loadDashboard } from '../lib/api/dashboard.js';
import { clearSession, hasSession } from '../lib/session.js';
import { currentRoute } from './router.js';
import { render } from './render.js';

export async function bootstrap() {
  window.__tceRender = render;
  window.__tceData = fallbackDashboard;
  window.__tceBackendStatus = { ok: false, checking: true };

  const backendStatus = await checkBackend();
  window.__tceBackendStatus = backendStatus;

  const path = currentRoute();
  if (path === '/signup' || path === '/login') {
    await render(fallbackDashboard, path);
    return;
  }

  if (!backendStatus.ok || !hasSession()) {
    if (!backendStatus.ok) {
      await render(fallbackDashboard, '/login');
      return;
    }
    await render(fallbackDashboard, '/login');
    return;
  }

  try {
    window.__tceData = await loadDashboard();
    await render(window.__tceData, path);
  } catch (error) {
    if (error.message === 'Session expired') {
      clearSession();
      history.replaceState({}, '', '/login');
      await render(fallbackDashboard, '/login');
      return;
    }
    console.error(error);
    await render(fallbackDashboard, path);
  }
}
