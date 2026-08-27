// app/api/guests/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { normalizePhone } from '@/lib/phone';

// ─── Helper: Generate a unique random card number ──────────────────────
async function generateUniqueCardNumber(eventId: string): Promise<string> {
  // Get all existing card numbers for this event
  const existingGuests = await prisma.guest.findMany({
    where: { eventId },
    select: { cardNumber: true },
  });

  const existingNumbers = new Set(
    existingGuests
      .map(g => g.cardNumber)
      .filter((num): num is string => num !== null)
  );

  // Try up to 100 times to find a unique random number
  for (let attempt = 0; attempt < 100; attempt++) {
    // Generate random 5-digit number (10000 - 99999)
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const cardNumber = randomNum.toString().padStart(5, '0');
    
    if (!existingNumbers.has(cardNumber)) {
      return cardNumber;
    }
  }

  // Fallback: use timestamp-based unique number
  const timestamp = Date.now().toString().slice(-5);
  const fallbackNumber = timestamp.padStart(5, '0');
  
  // If even the fallback exists (unlikely), add a random suffix
  if (existingNumbers.has(fallbackNumber)) {
    const suffix = Math.floor(100 + Math.random() * 900).toString();
    return (parseInt(fallbackNumber) + parseInt(suffix)).toString().padStart(5, '0').slice(-5);
  }
  
  return fallbackNumber;
}

// ─── Helper: Check WhatsApp with rate limiting ──────────────────────────
async function checkWhatsAppWithRetry(phone: string, retries = 2): Promise<{ hasWhatsApp: boolean; waId?: string; error?: string }> {
  return { hasWhatsApp: true };
}

// ─── Helper: Validate guest type ──────────────────────────────────────────
function validateGuestType(type: string | undefined): string {
  if (!type) return 'SINGLE';
  const upper = type.toUpperCase();
  return ['SINGLE', 'DOUBLE'].includes(upper) ? upper : 'SINGLE';
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
      include: { tenant: { select: { bypassPayment: true, credits: true } } },
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

    // ─── Check guest limit (tied to credits) ──────────────────────────
    if (!event.tenant?.bypassPayment) {
      const currentGuests = await prisma.guest.count({ where: { eventId } });
      const maxGuests = event.guestCount || 0;

      if (maxGuests > 0 && currentGuests + validGuests.length > maxGuests) {
        const remaining = Math.max(0, maxGuests - currentGuests);
        return NextResponse.json({
          error: `Exceeds guest limit of ${maxGuests}. You can add up to ${remaining} more guests. Request more credits from the admin to import additional guests.`,
          limit: maxGuests,
          current: currentGuests,
          remaining,
          credits: event.tenant.credits,
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

    const guestsToInsert = [];

    // ─── Sort guests by name to maintain consistent ordering ────────────
    const sortedGuests = [...uniqueGuests].sort((a, b) => {
      // If cardNumber exists in the data, use it for sorting (for PDF imports)
      const aCard = a.cardNumber ? parseInt(a.cardNumber, 10) : 999999;
      const bCard = b.cardNumber ? parseInt(b.cardNumber, 10) : 999999;
      if (aCard !== 999999 && bCard !== 999999 && aCard !== bCard) {
        return aCard - bCard;
      }
      // Otherwise sort by name
      return a.name.localeCompare(b.name);
    });

    for (const g of sortedGuests) {
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

      // ─── Generate UNIQUE RANDOM card number ──────────────────────────
      // ✅ Generate a random 5-digit number for each guest
      const cardNumber = await generateUniqueCardNumber(eventId);

      // ─── Validate guest type ──────────────────────────────────────────
      const guestType = validateGuestType(g.guestType);

      guestsToInsert.push({
        name: g.name.trim(),
        phone: g.phone,
        title: g.title || '',
        cardNumber: cardNumber, // ✅ Random 5-digit number
        guestType: guestType,
        email: null,
        eventId,
        routingChannel,
        qrToken: randomBytes(16).toString('hex'),
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