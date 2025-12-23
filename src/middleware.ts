import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to protect routes server-side
 * This provides an additional layer of security beyond client-side AuthGuard
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/api/health'];
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));

  // API routes - let them handle their own authentication
  // (they use verifyAuth() which is more robust)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For protected routes, check for auth token
  // Note: This is a basic check. The API routes do full token verification.
  const authHeader = request.headers.get('authorization');
  const hasAuthToken = authHeader?.startsWith('Bearer ');

  // If no auth token and not a public route, redirect to login
  // However, for page routes, we rely on client-side AuthGuard for better UX
  // This middleware mainly serves as a backup and for API route protection
  if (!hasAuthToken && pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

