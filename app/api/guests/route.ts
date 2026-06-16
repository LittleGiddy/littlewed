import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { normalizePhone } from '@/lib/phone';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, phone, eventId } = await req.json();
  if (!name || !phone || !eventId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Normalize: must start with '+'
  const { normalized, isValid } = normalizePhone(phone);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid phone number format. Must start with "+" and include country code (e.g., +255712345678).' }, { status: 400 });
  }

  // Check duplicate
  const existing = await prisma.guest.findFirst({
    where: { eventId, phone: normalized },
  });
  if (existing) {
    return NextResponse.json({ error: 'Guest already exists in this event' }, { status: 409 });
  }

  // Check limit
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { tenant: { select: { bypassPayment: true } } },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  if (!event.tenant?.bypassPayment && event.guestCount) {
    const currentCount = await prisma.guest.count({ where: { eventId } });
    if (currentCount >= event.guestCount) {
      return NextResponse.json({
        error: `Guest limit reached (${event.guestCount}). Please top up to add more.`,
      }, { status: 400 });
    }
  }

  const guest = await prisma.guest.create({
    data: {
      name,
      phone: normalized,
      email: null,
      eventId,
      routingChannel: 'sms',
      smsCode: randomBytes(4).toString('hex').toUpperCase(),
      qrToken: randomBytes(16).toString('hex'),
    },
  });

  return NextResponse.json(guest);
}