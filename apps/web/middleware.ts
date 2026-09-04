import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const dashboardPaths: Record<string, string | null> = {
  '/overview': null,
  '/position': 'positions',
  '/order': 'orders',
  '/settings': 'settings',
};

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const searchTab = request.nextUrl.searchParams.get('tab');

  if (pathname === '/dashboard' && searchTab) {
    const canonical =
      searchTab === 'positions'
        ? '/position'
        : searchTab === 'orders'
          ? '/order'
          : searchTab === 'overview'
            ? '/overview'
            : searchTab === 'settings'
              ? '/settings'
              : null;
    if (canonical) return NextResponse.redirect(new URL(canonical, request.url));
  }

  if (dashboardPaths[pathname] !== undefined) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    const tab = dashboardPaths[pathname];
    url.search = tab ? `?tab=${tab}` : '';
    return NextResponse.rewrite(url);
  }

  if (pathname === '/engine') {
    const url = request.nextUrl.clone();
    url.pathname = '/engines';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/overview', '/position', '/order', '/settings', '/engine'],
};
