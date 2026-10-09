import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessEvent, canManageTenant } from '@/lib/eventAccess';
import { generateQRFromCardNumber, generateExternalQrCode } from '@/lib/qr';

/**
 * Single event-level "external" QR code.
 *
 * Unlike the per-guest card QR (which encodes a guest cardNumber), this is ONE
 * code per event, stored on Event.externalQrCode. It is meant to be printed on
 * physical cards for guests who are NOT imported into the system. The staff
 * scanner recognises it and returns VALID on every scan, without creating or
 * matching any Guest row.
 *
 * GET  -> the QR as a PNG (create via POST first).
 * POST -> create the code if missing (idempotent), or rotate it when the body
 *         is `{ "rotate": true }` (owners only).
 */

export const runtime = 'nodejs';

const QR_SIZE = 1024;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    if (!(await canAccessEvent(session, eventId))) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { externalQrCode: true },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }
    if (!event.externalQrCode) {
      return NextResponse.json(
        { error: 'No QR code yet. Create one first.' },
        { status: 404 }
      );
    }

    const png = await generateQRFromCardNumber(event.externalQrCode, QR_SIZE);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Failed to render external QR code:', error);
    return NextResponse.json({ error: 'Could not load the QR code.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    if (!(await canAccessEvent(session, eventId))) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    let rotate = false;
    try {
      const body = await request.json();
      rotate = body?.rotate === true;
    } catch {
      rotate = false;
    }

    if (rotate && !canManageTenant(session.user.role)) {
      return NextResponse.json(
        { error: 'Only an event owner can regenerate the QR code.' },
        { status: 403 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { externalQrCode: true },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    if (event.externalQrCode && !rotate) {
      return NextResponse.json({ code: event.externalQrCode, created: false });
    }

    const code = generateExternalQrCode();
    await prisma.event.update({
      where: { id: eventId },
      data: { externalQrCode: code },
    });

    return NextResponse.json({ code, created: true });
  } catch (error) {
    console.error('Failed to create/rotate external QR code:', error);
    return NextResponse.json(
      { error: 'Could not create the QR code. Please try again.' },
      { status: 500 }
    );
  }
}
