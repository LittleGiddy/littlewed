import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Accept JSON body instead of form-data
    const { guests, eventId } = await req.json();

    if (!guests || !Array.isArray(guests) || guests.length === 0 || !eventId) {
      return NextResponse.json({ error: 'Missing guests or eventId' }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { tenant: { select: { bypassPayment: true } } },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // ─── Validate phone numbers (they are already normalized by frontend) ──
    // But we can still check for basic validity
    const validGuests = guests.filter((g: any) => g.phone && g.phone.startsWith('+'));
    const invalidCount = guests.length - validGuests.length;

    if (validGuests.length === 0) {
      return NextResponse.json({
        error: `No valid guest numbers found. ${invalidCount} entries had invalid phone numbers. Numbers must start with '+' and include the country code (e.g., +255712345678).`,
        invalidCount,
      }, { status: 400 });
    }

    // ─── Check guest limit ──────────────────────────────────────────────
    if (!event.tenant?.bypassPayment && event.guestCount) {
      const currentGuests = await prisma.guest.count({ where: { eventId } });
      if (currentGuests + validGuests.length > event.guestCount) {
        const remaining = Math.max(0, event.guestCount - currentGuests);
        return NextResponse.json({
          error: `Exceeds guest limit of ${event.guestCount}. You can add up to ${remaining} more guests.`,
        }, { status: 400 });
      }
    }

    // ─── Duplicate detection using phone ──────────────────────────────
    const phoneNumbers = validGuests.map((g: any) => g.phone);
    const existingGuests = await prisma.guest.findMany({
      where: {
        eventId,
        phone: { in: phoneNumbers },
      },
      select: { phone: true, name: true },
    });

    const existingPhones = new Set(existingGuests.map(g => g.phone));
    const duplicateNames: string[] = [];
    const uniqueGuests = validGuests.filter((g: any) => {
      if (existingPhones.has(g.phone)) {
        duplicateNames.push(g.name);
        return false;
      }
      return true;
    });

    if (uniqueGuests.length === 0) {
      return NextResponse.json({
        count: 0,
        skipped: validGuests.length,
        duplicateNames: existingGuests.map(g => g.name),
        invalidCount,
        message: 'All valid guests are duplicates. No new guests added.',
      });
    }

    // ─── Insert unique guests ──────────────────────────────────────────
    const guestsToInsert = uniqueGuests.map((g: any) => ({
      name: g.name,
      phone: g.phone, // already normalized by frontend
      email: g.email || null,
      eventId,
      routingChannel: 'sms',
      smsCode: randomBytes(4).toString('hex').toUpperCase(),
      qrToken: randomBytes(16).toString('hex'),
    }));

    const result = await prisma.guest.createMany({
      data: guestsToInsert,
      skipDuplicates: true,
    });

    return NextResponse.json({
      count: result.count,
      skipped: validGuests.length - result.count,
      invalidCount,
      duplicateNames: existingGuests.map(g => g.name),
      message: result.count > 0
        ? `Imported ${result.count} guest${result.count > 1 ? 's' : ''}${(validGuests.length - result.count) > 0 ? `, skipped ${validGuests.length - result.count} duplicate${(validGuests.length - result.count) > 1 ? 's' : ''}` : ''}${invalidCount > 0 ? `, ${invalidCount} invalid number${invalidCount > 1 ? 's' : ''} skipped` : ''}`
        : `No new guests imported (all ${validGuests.length} were duplicates${invalidCount > 0 ? `, ${invalidCount} invalid numbers` : ''})`,
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'unknown') },
      { status: 500 }
    );
  }
}