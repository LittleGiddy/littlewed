import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { normalizeGuestTitle } from '@/lib/guestTypes';
import { refundCreditsForUnsentDeleted } from '@/lib/credits';

// ─── DELETE ─────────────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  const { id } = await params;

  const guest = await prisma.guest.findFirst({
    where: { id, event: { tenantId } },
    select: { id: true, eventId: true, invitationSentAt: true },
  });
  if (!guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
  }

  await prisma.guest.delete({ where: { id } });

  // Refund 1 credit if the guest was never sent an invitation
  if (!guest.invitationSentAt) {
    await refundCreditsForUnsentDeleted(tenantId, guest.eventId, 1);
  }

  return NextResponse.json({ success: true });
}

// ─── PUT (Update Guest) ────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { id } = await params;
    const { name, phone, title } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const { normalized, isValid } = normalizePhone(phone);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Must start with "+" and include country code (e.g., +255712345678).' },
        { status: 400 }
      );
    }

    const scope = role === 'SUPER_ADMIN' ? { id } : { id, event: { tenantId } };
    const existingGuest = await prisma.guest.findFirst({
      where: scope,
    });

    if (!existingGuest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const duplicate = await prisma.guest.findFirst({
      where: {
        eventId: existingGuest.eventId,
        phone: normalized,
        id: { not: id },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: 'A guest with this phone number already exists in this event' },
        { status: 409 }
      );
    }

    const updatedGuest = await prisma.guest.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: normalized,
        ...(title !== undefined ? { title: normalizeGuestTitle(title) } : {}),
      },
    });

    return NextResponse.json({ success: true, guest: updatedGuest });
  } catch (error: any) {
    console.error('Error updating guest:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update guest' },
      { status: 500 }
    );
  }
}

// ─── PATCH (Update routing channel) ─────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { id } = await params;
    const { routingChannel, title } = await req.json();

    const data: { routingChannel?: string; title?: string | null } = {};

    if (routingChannel !== undefined) {
      if (!['whatsapp', 'sms'].includes(routingChannel)) {
        return NextResponse.json(
          { error: 'Invalid routing channel' },
          { status: 400 }
        );
      }
      data.routingChannel = routingChannel;
    }

    if (title !== undefined) {
      data.title = normalizeGuestTitle(title);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const scope = role === 'SUPER_ADMIN' ? { id } : { id, event: { tenantId } };
    const guest = await prisma.guest.findFirst({
      where: scope,
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const updatedGuest = await prisma.guest.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, guest: updatedGuest });
  } catch (error) {
    console.error('PATCH guest error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}