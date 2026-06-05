import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  try {
    const host = req.headers.get('host') || '';
    const { pathname } = req.nextUrl;

    // 1️⃣ Allow essential paths
    const publicPaths = [
      '/_next',
      '/api/auth',
      '/api/',
      '/favicon.ico',
      '/404',
      '/suspended',
      '/subscribe',
      '/register',
      '/login',
      '/signup',
      '/billing',
    ];

    if (publicPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.next();
    }

    // 2️⃣ Extract subdomain
    const hostname = host.split(':')[0];
    const parts = hostname.split('.');
    let subdomain: string | null = null;

    if (parts.length > 2) {
      subdomain = parts[0];
    } else if (parts.length === 2 && parts[1] === 'localhost') {
      subdomain = parts[0];
    }

    const isMainDomain = !subdomain || ['app', 'www', 'admin'].includes(subdomain);

    // 3️⃣ MAIN DOMAIN
    if (isMainDomain) {
      try {
        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) {
          console.error('NEXTAUTH_SECRET not configured');
          return NextResponse.next();
        }

        const token = await getToken({
          req,
          secret,
          cookieName: 'next-auth.session-token',
        });

        if (!token) {
          return NextResponse.redirect(new URL('/login', req.url));
        }

        if (pathname.startsWith('/client')) {
          const subscriptionStatus = token.subscriptionStatus as string;
          const role = token.role as string;
          if (role !== 'SUPER_ADMIN' && subscriptionStatus !== 'active') {
            return NextResponse.redirect(new URL('/subscribe', req.url));
          }
        }
      } catch (error) {
        console.error('Token verification error:', error);
        return NextResponse.next();
      }
      return NextResponse.next();
    }

    // 4️⃣ SUBDOMAIN (tenant specific)
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-subdomain', subdomain as string);
    requestHeaders.set('x-host', host);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch (error) {
    console.error('Middleware error:', error);
    // Return next() to avoid breaking the app
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};