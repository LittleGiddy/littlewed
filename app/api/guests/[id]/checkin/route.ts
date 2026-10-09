// app/api/check-in/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPushToTenantRole } from '@/lib/push';
import { guestTypeMaxScans, cardGroupIdCount, cardTotalScans, guestRecordMaxScans } from '@/lib/guestTypes';
import { eventScopeWhere, canAccessEvent } from '@/lib/eventAccess';

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
          where: { cardNumber: scannedCardNumber, event: eventScopeWhere(session) },
        });
      }
    }
    
    // ─── Find by manual card number entry ──────────────────────────────
    if (!guest && cardNumber) {
      const cleanCardNumber = cardNumber.trim().padStart(5, '0');
      if (cleanCardNumber) {
        guest = await prisma.guest.findFirst({
          where: { cardNumber: cleanCardNumber, event: eventScopeWhere(session) },
        });
      }
    }

    if (!guest) {
      return NextResponse.json(
        { error: 'Guest not found. Please check the card number.' },
        { status: 404 }
      );
    }

    // ─── Tenant scoping: guest's event must be in the caller's events ───────────
    const event = await prisma.event.findFirst({
      where: { id: guest.eventId, ...eventScopeWhere(session) },
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
    const tenantId = (session.user as any).tenantId;
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
    const undo = body?.undo === true;

    const guest = await prisma.guest.findFirst({
      where: { id, event: eventScopeWhere(session) },
    });
    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    // ─── Resolve the card group once (shared card / numeric group card) ─
    const groupMembers = guest.cardGroupId
      ? await prisma.guest.findMany({
          where: { eventId: guest.eventId, cardGroupId: guest.cardGroupId },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const groupSize = groupMembers.length;
    const labelCount = cardGroupIdCount(guest.cardGroupId);
    const isNumericGroup = labelCount !== null;
    const groupTotal = cardTotalScans(guest.cardGroupId, groupSize);
    const guestMax = guestRecordMaxScans(guest, groupSize);

    // ─── UNDO: step the last scan back ────────────────────────────────
    // Door staff scan fast and mis-scan. Undo only ever removes ONE scan from
    // ONE guest, so it can never silently clear a whole card or a WAKWE 30.
    if (undo) {
      const current = guest.checkInCount || 0;
      if (current <= 0) {
        return NextResponse.json(
          { error: `${guest.name} is not checked in - nothing to undo.` },
          { status: 400 }
        );
      }
      const reverted = await prisma.guest.update({
        where: { id: guest.id },
        data: {
          checkInCount: current - 1,
          // checkedIn is derived from the count, so it has to be recomputed
          // rather than simply cleared.
          checkedIn: current - 1 >= guestMax,
          checkedInAt: current - 1 > 0 ? guest.checkedInAt : null,
        },
      });
      const fullName = reverted.title ? `${reverted.title} ${reverted.name}` : reverted.name;
      sendPushToTenantRole(tenantId, 'CLIENT', {
        title: `Check-in undone: ${fullName}`,
        body: `${fullName} is back to ${reverted.checkInCount || 0}/${guestMax}.`,
        url: '/client/dashboard',
        type: 'info',
        sound: false,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        undid: true,
        guest: {
          id: reverted.id,
          name: reverted.name,
          checkInCount: reverted.checkInCount || 0,
          maxCheckIns: guestMax,
          fullyCheckedIn: Boolean(reverted.checkedIn),
        },
        message: `Undid the last scan for ${fullName}`,
      });
    }

    // ─── Collect the card's targets (shared card / numeric group card) ─
    const isGroup = groupSize > 1 || isNumericGroup;
    // A numeric group card ("Watu 20") is a SINGLE count-up bucket, so any
    // force/group action always covers the whole card. For a plain shared card
    // "all" means the whole card and a single action means just this guest; if
    // the caller asked for "all" on a lone guest we fall back to just them.
    const targets = (allGroup || isNumericGroup) && isGroup ? groupMembers : [guest];
    const accumulatorId = groupMembers[0]?.id;

    const updatedGuests = [];
    for (const target of targets) {
      // A guest on a shared card is ONE person (ceiling 1) - even if the row is
      // typed DOUBLE, because the card itself is what is shared. A numeric
      // group card instead counts up to its label; that total is split across
      // the group's rows with the remainder kept on the oldest (accumulator)
      // row. Outside any group the guestType rules apply.
      const others = targets.filter((t) => t.id !== accumulatorId).length;
      const tMax = isNumericGroup
        ? target.id === accumulatorId
          ? Math.max(1, groupTotal - others)
          : 1
        : groupSize > 1
          ? 1
          : guestTypeMaxScans(target.guestType, target.guestCount);
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
    // "Mark as Double" reuses this route, and a push that says "force checked in"
    // for a deliberate action reads like an error on the owner's phone.
    const viaDouble = body?.label === 'double';
    const viaGroup = body?.label === 'group';
    sendPushToTenantRole(tenantId, 'CLIENT', {
      title: viaDouble
        ? `${updatedGuests.length > 1 ? 'Card' : forceFullName} checked in together`
        : viaGroup
          ? `${updatedGuests.length > 1 ? 'Group card' : forceFullName} marked as arrived`
          : `${updatedGuests.length > 1 ? 'Card' : forceFullName} force checked in`,
      body: viaDouble
        ? `${label} marked as arrived in one go.`
        : viaGroup
          ? `${label} marked as arrived as a group in one go.`
          : `${label} has been force checked in.`,
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
        checkInCount: firstName.checkInCount || 0,
        maxCheckIns: firstName.checkInCount || guestRecordMaxScans(firstName, groupSize),
        fullyCheckedIn: true,
        checkedInAt: firstName.checkedInAt,
        cardGroupId: firstName.cardGroupId,
      },
      // Everyone the action touched, so the client can update the whole card in
      // one pass instead of refetching to discover the new state.
      updated: updatedGuests.map((g) => ({
        id: g.id,
        name: g.name,
        checkInCount: g.checkInCount || 0,
        maxCheckIns: g.checkInCount || guestRecordMaxScans(g, groupSize),
        fullyCheckedIn: Boolean(g.checkedIn),
      })),
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

    // Verify the caller may access this event (tenant owner, or staff with a
    // grant row for this specific event).
    const canAccess = await canAccessEvent(session, eventId);
    if (!canAccess) {
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