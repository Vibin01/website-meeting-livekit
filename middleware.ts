import { NextRequest, NextResponse } from 'next/server';

const protectedRoutes = ['/'];
const publicRoutes = ['/login'];
const COOKIE_NAME = '_connect_ec_backend_key';

export function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl;

    const isProtectedRoute = protectedRoutes.includes(pathname);
    const isPublicRoute = publicRoutes.includes(pathname);
    const hasCookie = req.cookies.has(COOKIE_NAME);

    // Rule 1: If logged in and trying to access an auth page (like /login), redirect to "/"
    if (hasCookie && isPublicRoute) {
      const homeUrl = req.nextUrl.clone();
      homeUrl.pathname = '/';
      homeUrl.search = '';
      return NextResponse.redirect(homeUrl);
    }

    // Rule 2: If NOT logged in and trying to access a protected page, redirect to "/login"
    if (!hasCookie && isProtectedRoute) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware execution error:', error);
    return NextResponse.next();
  }
}

// Routes Middleware should not run on (static assets, api, etc.)
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf)$).*)',
  ],
};
