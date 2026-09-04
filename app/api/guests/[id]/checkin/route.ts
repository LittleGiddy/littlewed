// app/api/check-in/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPushToTenantRole } from '@/lib/push';
import { guestTypeMaxScans } from '@/lib/guestTypes';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token, cardNumber } = await req.json();

    let guest = null;

    // ─── Find by QR token (contains card number) ────────────────────────
    if (token) {
      const scannedCardNumber = token.trim();
      if (scannedCardNumber) {
        guest = await prisma.guest.findFirst({
          where: { cardNumber: scannedCardNumber },
        });
      }
    }
    
    // ─── Find by manual card number entry ──────────────────────────────
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

    // ─── Tenant scoping: guest's event must belong to caller's tenant ───
    const tenantId = (session.user as any).tenantId;
    const event = await prisma.event.findFirst({
      where: { id: guest.eventId, tenantId },
      select: { id: true, name: true },
    });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found for this account.' },
        { status: 404 }
      );
    }

    // ─── Determine max check-ins based on guest type ────────────────────
    const maxCheckIns = guestTypeMaxScans(guest.guestType, guest.guestCount);
    const currentCount = guest.checkInCount || 0;

    // ─── Check if already checked in maximum times ──────────────────────
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

    // ─── Mark as checked in ──────────────────────────────────────────────
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
    sendPushToTenantRole(tenantId, 'CLIENT', {
      title: `${fullName} checked in`,
      body: isFullyCheckedIn
        ? `${fullName} has fully checked in to ${event.name} (${newCount}/${maxCheckIns}).`
        : `${fullName} checked in to ${event.name} (${newCount}/${maxCheckIns}).`,
      url: '/client/dashboard',
      type: 'success',
      sound: true,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      guest: {
        id: updated.id,
        name: updated.name,
        cardNumber: updated.cardNumber,
        guestType: updated.guestType || 'SINGLE',
        guestCount: updated.guestCount || null,
        checkInCount: newCount,
        maxCheckIns: maxCheckIns,
        fullyCheckedIn: isFullyCheckedIn,
        checkedInAt: updated.checkedInAt,
      },
      message: isFullyCheckedIn 
        ? `${guest.name} fully checked in (${newCount}/${maxCheckIns})`
        : `${guest.name} checked in (${newCount}/${maxCheckIns}) - ${maxCheckIns - newCount} more allowed`,
    });
  } catch (error: any) {
    console.error('Check‑in error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── PATCH: Force check-in a specific guest ────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const allGroup = body?.allGroup === true;

    const guest = await prisma.guest.findFirst({
      where: { id, event: { tenantId } },
    });
    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    // ─── Detect the group (shared DOUBLE card) ──────────────────────
    const groupMembers = guest.cardGroupId
      ? await prisma.guest.findMany({
          where: { eventId: guest.eventId, cardGroupId: guest.cardGroupId },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const isGroup = groupMembers.length > 1;
    // If the caller requested "all" but the guest isn't part of a real group,
    // fall back to just this guest.
    const targets = allGroup && isGroup ? groupMembers : [guest];

    const updatedGuests = [];
    for (const target of targets) {
      const tMax = guestTypeMaxScans(target.guestType, target.guestCount);
      const updated = await prisma.guest.update({
        where: { id: target.id },
        data: {
          checkedIn: true,
          checkInCount: tMax,
          checkedInAt: new Date(),
        },
      });
      updatedGuests.push(updated);
    }

    // ─── Notify the tenant owner(s) of the force check-in (fire & forget) ──
    const firstName = updatedGuests[0];
    const forceFullName = firstName.title ? `${firstName.title} ${firstName.name}` : firstName.name;
    const label =
      updatedGuests.length > 1
        ? `${updatedGuests.length} guests on the card`
        : forceFullName;
    sendPushToTenantRole(tenantId, 'CLIENT', {
      title: `${updatedGuests.length > 1 ? 'Card' : forceFullName} force checked in`,
      body: `${label} has been force checked in.`,
      url: '/client/dashboard',
      type: 'success',
      sound: true,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      count: updatedGuests.length,
      message:
        updatedGuests.length > 1
          ? `${updatedGuests.length} guests force checked in`
          : `${firstName.name} force checked in`,
      guest: {
        id: firstName.id,
        name: firstName.name,
        cardNumber: firstName.cardNumber,
        guestType: firstName.guestType || 'SINGLE',
        guestCount: firstName.guestCount || null,
        checkInCount: guestTypeMaxScans(firstName.guestType, firstName.guestCount),
        maxCheckIns: guestTypeMaxScans(firstName.guestType, firstName.guestCount),
        fullyCheckedIn: true,
        checkedInAt: firstName.checkedInAt,
      },
    });
  } catch (error: any) {
    console.error('Force check-in error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── GET: Get all guests for an event ──────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    const tenantId = (session.user as any).tenantId;
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
        guestCount: true,
        checkInCount: true,
        checkedIn: true,
        checkedInAt: true,
        phone: true,
        routingChannel: true,
        createdAt: true,
        cardGroupId: true,
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