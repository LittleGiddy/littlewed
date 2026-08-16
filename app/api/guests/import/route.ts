// app/api/guests/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { normalizePhone } from '@/lib/phone';

// ─── Helper: Get the next available card number ──────────────────────────
async function getNextCardNumber(eventId: string): Promise<string> {
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

// ─── Helper: Check WhatsApp with rate limiting ──────────────────────────
async function checkWhatsAppWithRetry(phone: string, retries = 2): Promise<{ hasWhatsApp: boolean; waId?: string; error?: string }> {
  // Since NexSMS doesn't have a direct check endpoint, assume WhatsApp is available
  // This will use WhatsApp if available, SMS as fallback
  return { hasWhatsApp: true };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guests, eventId, detectWhatsApp = true } = await req.json();

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

    // ─── Validate phone numbers and normalize ──────────────────────────
    const validGuests: any[] = [];
    let invalidCount = 0;

    for (const g of guests) {
      if (g.phone) {
        const { normalized, isValid } = normalizePhone(g.phone);
        if (isValid) {
          validGuests.push({
            ...g,
            phone: normalized,
          });
        } else {
          invalidCount++;
          console.log(`Invalid phone: ${g.phone} (${g.name})`);
        }
      } else {
        invalidCount++;
      }
    }

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
      select: { phone: true, name: true, routingChannel: true },
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
        message: `All valid guests are duplicates. No new guests added. (${invalidCount} invalid numbers skipped)`,
      });
    }

    // ─── Detect WhatsApp for each guest (if enabled) ──────────────────
    let whatsappCount = 0;
    let smsCount = 0;

    // ─── Get next available card number ──────────────────────────────────
    let nextCardNumber = await getNextCardNumber(eventId);
    let currentNumber = parseInt(nextCardNumber, 10);

    const guestsToInsert = [];

    for (const g of uniqueGuests) {
      let routingChannel = 'sms';
      
      if (detectWhatsApp && g.phone) {
        try {
          const result = await checkWhatsAppWithRetry(g.phone);
          if (result.hasWhatsApp) {
            routingChannel = 'whatsapp';
            whatsappCount++;
          } else {
            smsCount++;
          }
        } catch (error) {
          smsCount++;
          console.log(`WhatsApp check failed for ${g.name}:`, error);
        }
      } else {
        smsCount++;
      }

      // ─── Assign card number ──────────────────────────────────────────────
      // Use provided card number or generate next available
      let cardNumber = g.cardNumber || null;
      if (!cardNumber) {
        cardNumber = currentNumber.toString().padStart(5, '0');
        currentNumber++;
      }

      guestsToInsert.push({
        name: g.name.trim(),
        phone: g.phone,
        title: g.title || '',
        cardNumber: cardNumber, // ✅ 5-digit numeric
        guestType: g.guestType || 'SINGLE',
        email: null,
        eventId,
        routingChannel,
        qrToken: randomBytes(16).toString('hex'),
        // ❌ smsCode removed
      });
    }

    // ─── Insert guests in batches ──────────────────────────────────────
    const result = await prisma.guest.createMany({
      data: guestsToInsert,
      skipDuplicates: true,
    });

    // ─── Return response ──────────────────────────────────────────────
    const responseData: any = {
      count: result.count,
      skipped: validGuests.length - result.count,
      invalidCount,
      whatsappCount,
      smsCount,
      message: '',
    };

    if (duplicateNames.length > 0) {
      responseData.duplicateNames = duplicateNames;
    }

    if (result.count > 0) {
      responseData.message = `✅ Imported ${result.count} guest${result.count > 1 ? 's' : ''}`;
      if (validGuests.length - result.count > 0) {
        responseData.message += `, skipped ${validGuests.length - result.count} duplicate${(validGuests.length - result.count) > 1 ? 's' : ''}`;
      }
      if (invalidCount > 0) {
        responseData.message += `, ${invalidCount} invalid number${invalidCount > 1 ? 's' : ''} skipped`;
      }
      if (detectWhatsApp) {
        responseData.message += `. ${whatsappCount} on WhatsApp, ${smsCount} on SMS.`;
      }
    } else {
      responseData.message = `No new guests imported (all ${validGuests.length} were duplicates${invalidCount > 0 ? `, ${invalidCount} invalid numbers` : ''})`;
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'unknown') },
      { status: 500 }
    );
  }
}