import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths (no authentication needed)
  const publicPaths = ['/_next', '/api/auth', '/login', '/signup', '/favicon.ico', '/api/'];
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // For all other routes, authentication is handled by your layout/page components
  // (e.g., via getServerSession or useSession) – no middleware needed.
  // If you still want to protect routes at middleware level, you could add a token check here,
  // but it's optional.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};