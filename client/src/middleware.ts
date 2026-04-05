/**
 * @file middleware.ts
 * @description Protects routes — runs before every page load.
 *
 * WHAT IT DOES:
 * Not logged in + visits /dashboard → redirects to /login
 * Already logged in + visits /login → redirects to /dashboard
 *
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

const PROTECTED_ROUTES = [
  '/dashboard',
  '/projects',
  '/tasks',
  '/teams',
  '/settings',
  '/analytics',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read auth cookie (set by the auth slice on login)
  const isAuthenticated =
    request.cookies.get('teamflow_authenticated')?.value === 'true';

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // Not authenticated trying to access protected page
  if (isProtected && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Already authenticated trying to access login/register
  if (isPublic && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};