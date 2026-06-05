import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const { pathname } = req.nextUrl;

  // 1️⃣ Allow essential paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    pathname === '/404' ||
    pathname === '/suspended' ||
    pathname === '/subscribe' ||
    pathname === '/register' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/billing'
  ) {
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
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
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
    return NextResponse.next();
  }

  // 4️⃣ SUBDOMAIN (tenant specific)
  // ✅ Don't use Prisma in middleware — just pass subdomain via headers
  // Pages/API routes will query Prisma to get tenant info
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-subdomain', subdomain as string);
  requestHeaders.set('x-host', host);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};