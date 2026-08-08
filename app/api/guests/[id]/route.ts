import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';

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
  });
  if (!guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
  }

  await prisma.guest.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

// ─── PUT (Update Guest) ────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { id } = await params;
    const { name, phone } = await req.json();

    // ─── Validation ──────────────────────────────────────────────────────
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Normalize phone number
    const { normalized, isValid } = normalizePhone(phone);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Must start with "+" and include country code (e.g., +255712345678).' },
        { status: 400 }
      );
    }

    // ─── Check if guest exists and belongs to tenant ────────────────────
    const existingGuest = await prisma.guest.findFirst({
      where: { id, event: { tenantId } },
    });

    if (!existingGuest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    // ─── Check for duplicate phone in the same event ────────────────────
    const duplicate = await prisma.guest.findFirst({
      where: {
        eventId: existingGuest.eventId,
        phone: normalized,
        id: { not: id }, // exclude current guest
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: 'A guest with this phone number already exists in this event' },
        { status: 409 }
      );
    }

    // ─── Update guest ────────────────────────────────────────────────────
    const updatedGuest = await prisma.guest.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: normalized,
        // Routing channel is automatically determined by phone format
        // If you want to allow changing routing channel, add it here
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