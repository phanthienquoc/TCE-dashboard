export const routes = ['/', '/positions', '/orders', '/platforms', '/security'];

export function currentRoute() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

export function navigate(to) {
  const nextRoute = routes.includes(to) ? to : '/';
  history.pushState({}, '', nextRoute);
  window.__tceRender?.(window.__tceData, nextRoute);
}

export function bindRouter() {
  window.addEventListener('popstate', () => window.__tceRender?.(window.__tceData, currentRoute()));
  document.querySelectorAll('[data-route]').forEach((element) => element.addEventListener('click', () => navigate(element.dataset.route)));
}
