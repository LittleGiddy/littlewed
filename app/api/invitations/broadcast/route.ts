import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms/index';

// ─── Helper: Get formatted guest name ──────────────────────────────────
function getGuestFullName(guest: any): string {
  const title = guest.title || 'Mr';
  return `${title} ${guest.name}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { eventId, guestIds, message, type } = await req.json();

    if (!eventId || !guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
      return NextResponse.json({ error: 'Missing eventId or guestIds' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // ─── Fetch guests ────────────────────────────────────────────────────
    const guests = await prisma.guest.findMany({
      where: {
        id: { in: guestIds },
        event: { tenantId },
      },
      include: {
        event: true,
      },
    });

    if (guests.length === 0) {
      return NextResponse.json({ error: 'No guests found' }, { status: 404 });
    }

    const results = [];
    let successCount = 0;

    for (const guest of guests) {
      try {
        if (!guest.phone) {
          results.push({
            guestId: guest.id,
            name: guest.name,
            success: false,
            error: 'No phone number',
          });
          continue;
        }

        // ─── Prepare the message ─────────────────────────────────────────
        const fullName = getGuestFullName(guest);
        const cardInfo = guest.cardNumber ? ` (Card: ${guest.cardNumber})` : '';
        const finalMessage = `${message}${cardInfo}`;

        // ─── Send SMS via NexSMS ────────────────────────────────────────
        const result = await sendSMS({
          to: guest.phone,
          message: finalMessage,
        });

        if (result.success) {
          successCount++;
          
          // ─── Update guest record ──────────────────────────────────────
          const updateData: any = {
            invitationSentAt: new Date(),
          };
          
          // Only add thanksSentAt if type is 'thanks'
          if (type === 'thanks') {
            updateData.thanksSentAt = new Date();
          }

          await prisma.guest.update({
            where: { id: guest.id },
            data: updateData,
          });

          results.push({
            guestId: guest.id,
            name: guest.name,
            success: true,
          });
        } else {
          results.push({
            guestId: guest.id,
            name: guest.name,
            success: false,
            error: result.error || 'Failed to send SMS',
          });
        }
      } catch (error: any) {
        console.error(`Failed to send to ${guest.name}:`, error);
        results.push({
          guestId: guest.id,
          name: guest.name,
          success: false,
          error: error.message || 'Unknown error',
        });
      }

      // Small delay between messages to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    return NextResponse.json({
      success: true,
      total: guests.length,
      successCount,
      results,
    });
  } catch (error: any) {
    console.error('Broadcast error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send broadcast' },
      { status: 500 }
    );
  }
}