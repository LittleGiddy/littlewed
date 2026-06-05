import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  try {
    const host = req.headers.get('host') || '';
    const { pathname } = req.nextUrl;

    // Allow public paths
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/favicon')
    ) {
      return NextResponse.next();
    }

    // Extract subdomain for production (littlewed.com)
    const hostname = host.split(':')[0];
    const parts = hostname.split('.');
    let subdomain: string | null = null;

    // Only extract subdomain if on custom domain (not vercel.app)
    if (!hostname.includes('vercel.app') && parts.length > 2) {
      subdomain = parts[0];
    }

    // On Vercel free plan, skip subdomain logic
    if (hostname.includes('vercel.app')) {
      return NextResponse.next();
    }

    // Forward subdomain for custom domains
    const requestHeaders = new Headers(req.headers);
    if (subdomain && !['app', 'www', 'admin'].includes(subdomain)) {
      requestHeaders.set('x-subdomain', subdomain);
      requestHeaders.set('x-host', host);
    }

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};