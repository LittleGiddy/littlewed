import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const guestId = req.nextUrl.searchParams.get('guestId');
  if (!guestId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const guest = await prisma.guest.findUnique({ where: { id: guestId } });
  if (!guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
  }

  if (guest.checkedIn) {
    return NextResponse.redirect(
      new URL(`/check-in/success?name=${encodeURIComponent(guest.name)}`, req.url)
    );
  }

  await prisma.guest.update({
    where: { id: guestId },
    data: { checkedIn: true, checkedInAt: new Date() },
  });

  return NextResponse.redirect(
    new URL(`/check-in/success?name=${encodeURIComponent(guest.name)}`, req.url)
  );
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guestIdFromQuery = req.nextUrl.searchParams.get('guestId');
    let guest = null;

    if (guestIdFromQuery) {
      guest = await prisma.guest.findUnique({ where: { id: guestIdFromQuery } });
    } else {
      let body;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const { token, smsCode } = body;

      if (token) {
        // 1. Try to find by qrToken
        guest = await prisma.guest.findFirst({ where: { qrToken: token } });

        // 2. If not found, try to extract guestId from a URL
        if (!guest) {
          const guestIdMatch = token.match(/guestId=([^&]+)/);
          if (guestIdMatch) {
            guest = await prisma.guest.findUnique({
              where: { id: guestIdMatch[1] },
            });
          }
        }
      } else if (smsCode) {
        guest = await prisma.guest.findUnique({ where: { smsCode } });
      } else {
        return NextResponse.json(
          { error: 'Missing guestId, token, or smsCode' },
          { status: 400 }
        );
      }
    }

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    if (guest.checkedIn) {
      return NextResponse.json(
        { error: 'Guest already checked in' },
        { status: 400 }
      );
    }

    // Mark as checked in
    await prisma.guest.update({
      where: { id: guest.id },
      data: { checkedIn: true, checkedInAt: new Date() },
    });

    if (guestIdFromQuery) {
      return NextResponse.redirect(
        new URL(`/check-in/success?name=${encodeURIComponent(guest.name)}`, req.url)
      );
    }

    // Return the updated guest with a no-cache header
    return NextResponse.json(
      {
        success: true,
        guest: {
          id: guest.id,
          name: guest.name,
          checkedIn: true,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Check‑in error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}