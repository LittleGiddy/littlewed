import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const { pathname } = req.nextUrl;

  // 1️⃣ Always allow essential paths
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
  // Use camelCase field names as in schema
  const tenant = await prisma.tenant.findUnique({
    where: { subdomain: subdomain! },
    select: { subscriptionStatus: true, id: true },
  });

  if (!tenant) {
    return NextResponse.redirect(new URL('/404', req.url));
  }

  const isClientPath = pathname.startsWith('/client');
  if (isClientPath && tenant.subscriptionStatus !== 'active') {
    const billingUrl = new URL('/subscribe', req.url);
    billingUrl.searchParams.set('tenantId', tenant.id);
    return NextResponse.redirect(billingUrl);
  }

  // Forward tenant context
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-tenant-id', tenant.id);
  requestHeaders.set('x-subdomain', subdomain as string);
  requestHeaders.set('x-host', host);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};