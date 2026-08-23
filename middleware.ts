// middleware.ts (if you have one)
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // If trying to access dashboard while inactive, redirect to pending activation
    if (path.startsWith('/client/dashboard') && token?.isActive === false) {
      return NextResponse.redirect(new URL('/client/pending-activation', req.url));
    }

    // If trying to access pending activation while active, redirect to dashboard
    if (path.startsWith('/client/pending-activation') && token?.isActive === true) {
      return NextResponse.redirect(new URL('/client/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/client/:path*', '/admin/:path*'],
};