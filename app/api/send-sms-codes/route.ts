import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms/index';

// ─── Helper: Generate a unique 5-digit card number ──────────────────────
async function generateUniqueCardNumber(eventId: string): Promise<string> {
  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: { cardNumber: true },
  });

  const numbers: number[] = [];
  for (const guest of guests) {
    if (guest.cardNumber !== null) {
      const num = parseInt(guest.cardNumber, 10);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
  }

  numbers.sort((a, b) => a - b);

  let nextNumber = 1;
  for (const num of numbers) {
    if (num === nextNumber) {
      nextNumber++;
    } else if (num > nextNumber) {
      break;
    }
  }

  return nextNumber.toString().padStart(5, '0');
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { eventId } = await req.json();

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: { guests: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const customMessage = event.customMessage || "You're invited!";

    // ─── Filter guests without card numbers ──────────────────────────────
    const guestsWithoutCard = event.guests.filter(g => !g.cardNumber);

    if (guestsWithoutCard.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All guests already have card numbers',
        results: [],
      });
    }

    const results = [];

    for (const guest of guestsWithoutCard) {
      if (!guest.phone) {
        results.push({
          guestId: guest.id,
          name: guest.name,
          success: false,
          error: 'No phone number',
        });
        continue;
      }

      try {
        // ─── Generate unique card number ──────────────────────────────────
        const cardNumber = await generateUniqueCardNumber(eventId);

        // ─── Update guest with card number ────────────────────────────────
        await prisma.guest.update({
          where: { id: guest.id },
          data: { cardNumber },
        });

        // ─── Prepare message ──────────────────────────────────────────────
        const fullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
        const message = `${customMessage} Hello ${fullName}, your entry card number for ${event.name} is: ${cardNumber}. Please show this at the entrance.`;

        // ─── Send SMS via NexSMS ──────────────────────────────────────────
        const result = await sendSMS({
          to: guest.phone,
          message: message,
        });

        if (result.success) {
          results.push({
            guestId: guest.id,
            name: guest.name,
            cardNumber: cardNumber,
            success: true,
          });
        } else {
          throw new Error(result.error || 'SMS sending failed');
        }
      } catch (error: any) {
        console.error(`Failed for ${guest.name}:`, error.message);
        results.push({
          guestId: guest.id,
          name: guest.name,
          success: false,
          error: error.message || 'Unknown error',
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Sent ${successCount} of ${results.length} card numbers`,
      results,
    });
  } catch (error: any) {
    console.error('Send SMS codes error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send SMS codes' },
      { status: 500 }
    );
  }
}