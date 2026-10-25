import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const searchTab = request.nextUrl.searchParams.get('tab');

  if (pathname === '/dashboard') {
    const canonical =
      searchTab === 'positions'
        ? '/position'
        : searchTab === 'orders'
          ? '/order'
          : searchTab === 'settings'
            ? '/settings'
            : '/overview';
    return NextResponse.redirect(new URL(canonical, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard'],
};
