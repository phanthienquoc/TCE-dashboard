import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const dashboardTabRoutes: Record<string, string> = {
  '/dashboard/positions': 'positions',
  '/dashboard/orders': 'orders',
  '/dashboard/settings': 'settings',
};

export function middleware(request: NextRequest) {
  const tab = dashboardTabRoutes[request.nextUrl.pathname];
  if (!tab) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/dashboard';
  url.search = `?tab=${tab}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/dashboard/positions', '/dashboard/orders', '/dashboard/settings'],
};
