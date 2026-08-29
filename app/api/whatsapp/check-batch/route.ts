// app/api/whatsapp/check-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';

// ─── Helper: Check WhatsApp using NexSMS ──────────────────────────────
async function checkWhatsAppNumber(phone: string): Promise<{ hasWhatsApp: boolean; waId?: string; error?: string }> {
  // WhatsApp presence cannot be detected reliably ahead of time, so we report
  // no WhatsApp by default to avoid auto-routing guests to WhatsApp.
  // The delivery webhook handles failures and the client can manually switch
  // a guest to WhatsApp.
  return { hasWhatsApp: false };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId, guestIds } = await req.json();

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Fetch guests - either specific ones or all guests in the event
    const where: any = { eventId };
    if (guestIds && Array.isArray(guestIds) && guestIds.length > 0) {
      where.id = { in: guestIds };
    }

    const guests = await prisma.guest.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        routingChannel: true,
      },
    });

    if (guests.length === 0) {
      return NextResponse.json({ 
        error: 'No guests found', 
        whatsappCount: 0,
        smsCount: 0,
        total: 0,
        results: [],
      });
    }

    const results = [];
    let whatsappCount = 0;
    let smsCount = 0;

    for (const guest of guests) {
      try {
        if (!guest.phone) {
          results.push({
            id: guest.id,
            name: guest.name,
            phone: null,
            hasWhatsApp: false,
            error: 'No phone number',
          });
          smsCount++;
          continue;
        }

        const { normalized, isValid } = normalizePhone(guest.phone);
        if (!isValid) {
          results.push({
            id: guest.id,
            name: guest.name,
            phone: guest.phone,
            hasWhatsApp: false,
            error: 'Invalid phone number',
          });
          smsCount++;
          continue;
        }

        // ─── Check if number has WhatsApp ────────────────────────────
        const result = await checkWhatsAppNumber(normalized);
        const hasWhatsApp = result.hasWhatsApp;

        // ─── Update guest routing channel if WhatsApp is available ──
        if (hasWhatsApp && guest.routingChannel !== 'whatsapp') {
          await prisma.guest.update({
            where: { id: guest.id },
            data: { routingChannel: 'whatsapp' },
          });
          whatsappCount++;
        } else if (hasWhatsApp) {
          whatsappCount++;
        } else {
          // If no WhatsApp, ensure routing is SMS
          if (guest.routingChannel !== 'sms') {
            await prisma.guest.update({
              where: { id: guest.id },
              data: { routingChannel: 'sms' },
            });
          }
          smsCount++;
        }

        results.push({
          id: guest.id,
          name: guest.name,
          phone: normalized,
          hasWhatsApp,
          waId: result.waId,
          previousChannel: guest.routingChannel,
          newChannel: hasWhatsApp ? 'whatsapp' : 'sms',
        });
      } catch (error: any) {
        console.error(`WhatsApp check error for ${guest.name}:`, error);
        results.push({
          id: guest.id,
          name: guest.name,
          phone: guest.phone,
          hasWhatsApp: false,
          error: error.message || 'Check failed',
        });
        smsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      total: guests.length,
      whatsappCount,
      smsCount,
      results,
    });
  } catch (error: any) {
    console.error('Batch WhatsApp check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check WhatsApp numbers' },
      { status: 500 }
    );
  }
}