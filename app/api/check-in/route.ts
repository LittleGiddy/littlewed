import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ─── Helper Functions ────────────────────────────────────────────────

function formatCheckInTime(date: Date): string {
  return date.toLocaleString('en-TZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Dar_es_Salaam',
  });
}

function getTimeUntil(date: Date): string {
  const diff = date.getTime() - new Date().getTime();
  if (diff <= 0) return 'now';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}${
      minutes > 0 ? ` and ${minutes} minute${minutes > 1 ? 's' : ''}` : ''
    }`;
  }
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

function getCheckInStartTime(
  eventDate: Date,
  customStartTime: Date | null
): Date {
  // If custom check-in start time is set, use it
  if (customStartTime) {
    return new Date(customStartTime);
  }

  // Otherwise, use the event date at midnight (or use a default time)
  const startTime = new Date(eventDate);
  // Set to midnight by default - you can adjust this
  startTime.setHours(0, 0, 0, 0);
  
  return startTime;
}

// ─── GET Handler ─────────────────────────────────────────────────────

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

// ─── POST Handler ────────────────────────────────────────────────────

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
        guest = await prisma.guest.findFirst({ where: { qrToken: token } });

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

    // ─── TIME VALIDATION: Check if event has started ──────────────────
    const event = await prisma.event.findUnique({
      where: { id: guest.eventId },
      select: {
        id: true,
        name: true,
        date: true,
        checkInStartTime: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Determine when check-in becomes available
    const checkInAvailableAt = getCheckInStartTime(
      event.date,
      event.checkInStartTime
    );

    const now = new Date();

    // ─── Block check-in if event hasn't started ──────────────────────
    if (now < checkInAvailableAt) {
      const timeUntil = getTimeUntil(checkInAvailableAt);
      const formattedTime = formatCheckInTime(checkInAvailableAt);
      return NextResponse.json(
        {
          error: `Check-in will be available at ${formattedTime} (${timeUntil} from now)`,
          availableAt: checkInAvailableAt.toISOString(),
        },
        { status: 403 }
      );
    }

    // ─── Check if already checked in ──────────────────────────────────
    if (guest.checkedIn) {
      return NextResponse.json(
        { error: 'Guest already checked in' },
        { status: 400 }
      );
    }

    // ─── Mark as checked in ────────────────────────────────────────────
    await prisma.guest.update({
      where: { id: guest.id },
      data: { checkedIn: true, checkedInAt: new Date() },
    });

    if (guestIdFromQuery) {
      return NextResponse.redirect(
        new URL(`/check-in/success?name=${encodeURIComponent(guest.name)}`, req.url)
      );
    }

    // ─── Success Response ──────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        guest: {
          id: guest.id,
          name: guest.name,
          guestType: guest.guestType || null,
          email: guest.email || null,
          phone: guest.phone || null,
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