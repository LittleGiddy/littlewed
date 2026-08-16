// app/api/guests/next-card-number/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // ─── Get all card numbers for this event ────────────────────────────
    const guests = await prisma.guest.findMany({
      where: { eventId },
      select: { cardNumber: true },
    });

    // ─── Extract numeric card numbers, filtering out null values ──────
    const numbers: number[] = [];

    for (const guest of guests) {
      if (guest.cardNumber !== null) {
        const num = parseInt(guest.cardNumber, 10);
        if (!isNaN(num)) {
          numbers.push(num);
        }
      }
    }

    // Sort numbers in ascending order
    numbers.sort((a, b) => a - b);

    // ─── Find the next available number (starting from 1) ──────────────
    let nextNumber = 1;
    for (const num of numbers) {
      if (num === nextNumber) {
        nextNumber++;
      } else if (num > nextNumber) {
        break;
      }
    }

    // ─── Pad to 5 digits ──────────────────────────────────────────────────
    const cardNumber = nextNumber.toString().padStart(5, '0');

    return NextResponse.json({ cardNumber });
  } catch (error: any) {
    console.error('Error generating next card number:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate card number' },
      { status: 500 }
    );
  }
}