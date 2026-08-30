export const APP_ROUTES = {
  dashboard: '/dashboard',
  engines: '/engines',
  notifications: '/notifications',
  settings: '/dashboard?tab=settings',
} as const;

export function routeForNavigation(id: string): string | null {
  switch (id) {
    case 'overview':
      return APP_ROUTES.dashboard;
    case 'positions':
    case 'orders':
      return `/dashboard?tab=${id}`;
    case 'engine':
      return APP_ROUTES.engines;
    case 'notifications':
      return APP_ROUTES.notifications;
    case 'settings':
      return APP_ROUTES.settings;
    default:
      return null;
  }
}
