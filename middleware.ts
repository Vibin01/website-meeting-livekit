import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// 1. Specify protected and public routes
const protectedRoutes = ['/'];
const publicRoutes = ['/login'];

export default async function middleware(req: NextRequest) {
  // 2. Check if the current route is protected or public
  const path = req.nextUrl.pathname;

  const isProtectedRoute = protectedRoutes.includes(path);
  const isPublicRoute = publicRoutes.includes(path);

  const COOKIE_NAME = '_connect_ec_backend_key';
  const hasCookie = req.cookies.has(COOKIE_NAME);

  // Rule 1: If logged in and trying to access an auth page (like /login), redirect to "/"
  if (hasCookie && isPublicRoute) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Rule 2: If NOT logged in and trying to access a protected page, redirect to "/login"
  if (!hasCookie && isProtectedRoute) {
    // Optional: Pass the original path as a query param to redirect back after login
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Routes Middleware should not run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
