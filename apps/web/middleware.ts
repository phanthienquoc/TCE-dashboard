import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const dashboardPaths: Record<string, string | null> = {
  '/overview': null,
  '/position': 'positions',
  '/order': 'orders',
};

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const searchTab = request.nextUrl.searchParams.get('tab');

  // Canonical dashboard URLs. Keep the existing dashboard implementation
  // behind clean public paths while removing query-string navigation.
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

  if (pathname === '/overview' || pathname === '/position' || pathname === '/order') {
    const tab = dashboardPaths[pathname];
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = tab ? `?tab=${tab}` : '';
    return NextResponse.rewrite(url);
  }

  // Stable singular alias for the engine area.
  if (pathname === '/engine') {
    const url = request.nextUrl.clone();
    url.pathname = '/engines';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/overview', '/position', '/order', '/engine'],
};
