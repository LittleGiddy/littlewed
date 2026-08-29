import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPushToTenantRole } from '@/lib/push';

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
  if (customStartTime) {
    return new Date(customStartTime);
  }

  const startTime = new Date(eventDate);
  startTime.setHours(0, 0, 0, 0);
  return startTime;
}

// ─── GET Handler ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    // Verify the event belongs to the caller's tenant.
    const event = await prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const guests = await prisma.guest.findMany({
      where: { eventId },
      select: {
        id: true,
        name: true,
        title: true,
        cardNumber: true,
        guestType: true,
        checkInCount: true,
        checkedIn: true,
        checkedInAt: true,
        phone: true,
        routingChannel: true,
        createdAt: true,
      },
      orderBy: { cardNumber: 'asc' },
    });

    return NextResponse.json(guests);
  } catch (error: any) {
    console.error('Error fetching guests:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch guests' },
      { status: 500 }
    );
  }
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

    // ─── If guestId is provided directly ──────────────────────────────
    if (guestIdFromQuery) {
      guest = await prisma.guest.findUnique({
        where: { id: guestIdFromQuery },
      });
    } else {
      // ─── Parse request body ──────────────────────────────────────────
      let body;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const { token, cardNumber } = body;

      // ─── Find by QR token (contains card number) ────────────────────
      if (token) {
        const scannedCardNumber = token.trim();
        if (scannedCardNumber) {
          guest = await prisma.guest.findFirst({
            where: { cardNumber: scannedCardNumber },
          });
        }
      }

      // ─── Find by manual card number entry ────────────────────────────
      if (!guest && cardNumber) {
        const cleanCardNumber = cardNumber.trim().padStart(5, '0');
        if (cleanCardNumber) {
          guest = await prisma.guest.findFirst({
            where: { cardNumber: cleanCardNumber },
          });
        }
      }

      if (!guest) {
        return NextResponse.json(
          { error: 'Guest not found. Please check the card number.' },
          { status: 404 }
        );
      }
    }

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    // ─── TIME VALIDATION: Check if event has started ──────────────────
    const event = await prisma.event.findFirst({
      where: { id: guest.eventId, tenantId: (session.user as any).tenantId },
      select: {
        id: true,
        name: true,
        date: true,
        checkInStartTime: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found for this account.' },
        { status: 404 }
      );
    }

    const checkInAvailableAt = getCheckInStartTime(
      event.date,
      event.checkInStartTime
    );

    const now = new Date();

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

    // ─── DOUBLE CHECK-IN LOGIC ──────────────────────────────────────
    const maxCheckIns = guest.guestType?.toUpperCase() === 'DOUBLE' ? 2 : 1;
    const currentCount = guest.checkInCount || 0;

    // ─── Check if already checked in maximum times ──────────────────
    if (currentCount >= maxCheckIns) {
      return NextResponse.json(
        {
          error: `Guest already checked in ${currentCount} time${currentCount > 1 ? 's' : ''}. Maximum: ${maxCheckIns}`,
          checkedIn: true,
          checkInCount: currentCount,
          maxCheckIns: maxCheckIns,
        },
        { status: 400 }
      );
    }

    // ─── Mark as checked in ────────────────────────────────────────────
    const newCount = currentCount + 1;
    const isFullyCheckedIn = newCount >= maxCheckIns;

    const updated = await prisma.guest.update({
      where: { id: guest.id },
      data: {
        checkInCount: newCount,
        checkedIn: isFullyCheckedIn,
        checkedInAt: new Date(),
      },
    });

    // ─── Notify the tenant owner(s) of the check-in (fire & forget) ──
    const fullName = updated.title ? `${updated.title} ${updated.name}` : updated.name;
    sendPushToTenantRole((session.user as any).tenantId, 'CLIENT', {
      title: `${fullName} checked in`,
      body: isFullyCheckedIn
        ? `${fullName} has fully checked in to ${event.name} (${newCount}/${maxCheckIns}).`
        : `${fullName} checked in to ${event.name} (${newCount}/${maxCheckIns}).`,
      url: '/client/dashboard',
      type: 'success',
      sound: true,
    }).catch(() => {});

    // ─── If called with guestId, redirect to success page ─────────────
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
          id: updated.id,
          name: updated.name,
          cardNumber: updated.cardNumber,
          guestType: updated.guestType || 'SINGLE',
          checkInCount: newCount,
          maxCheckIns: maxCheckIns,
          fullyCheckedIn: isFullyCheckedIn,
          checkedInAt: updated.checkedInAt,
        },
        message: isFullyCheckedIn
          ? `${updated.name} fully checked in (${newCount}/${maxCheckIns})`
          : `${updated.name} checked in (${newCount}/${maxCheckIns}) - ${maxCheckIns - newCount} more allowed`,
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