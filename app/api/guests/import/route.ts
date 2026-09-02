// app/api/guests/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
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
// WhatsApp presence cannot be reliably detected ahead of time, so guests are
// defaulted to SMS. Keep this return value false to avoid auto-routing guests
// to WhatsApp; users can manually switch a guest (or all) to WhatsApp.
async function checkWhatsAppWithRetry(phone: string, retries = 2): Promise<{ hasWhatsApp: boolean; waId?: string; error?: string }> {
  return { hasWhatsApp: false };
}

// ─── Helper: Validate guest type ──────────────────────────────────────────
// Accepts raw values like "WAKWE 30" or "Familia 20" and returns
// { type, count } where count is only set for FAMILIA/WAKWE.
function validateGuestType(type: string | undefined): { type: string; count: number | null } {
  if (!type) return { type: 'SINGLE', count: null };
  const upper = type.trim().toUpperCase();
  const match = upper.match(/^([A-Z]+)\s*(\d+)?$/);
  if (!match) return { type: 'SINGLE', count: null };
  const typeUpper = match[1];
  if (!['SINGLE', 'DOUBLE', 'FAMILIA', 'WAKWE'].includes(typeUpper)) {
    return { type: 'SINGLE', count: null };
  }
  const count = match[2] ? parseInt(match[2], 10) : null;
  const isGroupType = typeUpper === 'FAMILIA' || typeUpper === 'WAKWE';
  return {
    type: typeUpper,
    count: isGroupType && Number.isFinite(count) && (count as number) > 0 ? count : null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guests, eventId, detectWhatsApp = false } = await req.json();

    if (!guests || !Array.isArray(guests) || guests.length === 0 || !eventId) {
      return NextResponse.json({ error: 'Missing guests or eventId' }, { status: 400 });
    }

    const tenantId = (session.user as any).tenantId;

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: { tenant: { select: { bypassPayment: true, credits: true, creditsEnabled: true } } },
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

    // ─── Credit check (1 credit per guest; credits are now the only limit) ─
    const creditsDisabled = event.tenant?.creditsEnabled === false;
    if (!event.tenant?.bypassPayment || creditsDisabled) {
      const tenantCredits = creditsDisabled ? 0 : (event.tenant.credits ?? 0);
      if (tenantCredits < uniqueGuests.length) {
        const remaining = tenantCredits;
        return NextResponse.json({
          error: creditsDisabled
            ? "Your account's credits have been disabled by the admin. Please contact support to re-enable them."
            : `You don't have enough credits to import ${uniqueGuests.length} guests. You have ${remaining} credit${remaining === 1 ? '' : 's'} remaining. Request more credits from the admin to continue importing.`,
          needsCredits: !creditsDisabled,
          creditsDisabled,
          credits: remaining,
          needed: uniqueGuests.length,
          alreadyProcessed: 0,
        }, { status: 400 });
      }
    }

    // ─── Detect WhatsApp for each guest (if enabled) ──────────────────
    let whatsappCount = 0;
    let smsCount = 0;

    const guestsToInsert = [];
    // Maps a shared-card group id to the card number assigned to that group,
    // so all rows in a shared DOUBLE card reuse the same card number.
    const groupCardNumbers = new Map<string, string>();

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

      // ─── Guest type & shared card grouping ──────────────────────────
      // Rows that share a non-empty `cardGroupId` form a shared DOUBLE
      // card (two guests, one card number, one composed card image).
      // FAMILIA/WAKWE keep their own type with a group count.
      const rawGroupId = typeof g.cardGroupId === 'string' ? g.cardGroupId.trim() : '';
      const isGrouped = rawGroupId.length > 0;
      const parsed = validateGuestType(g.guestType);
      const guestType = isGrouped && parsed.type === 'SINGLE' ? 'DOUBLE' : parsed.type;
      const guestCount = parsed.type === 'FAMILIA' || parsed.type === 'WAKWE' ? parsed.count : null;

      // ─── Card number: reuse the group's number or mint a new one ──────
      let cardNumber: string;
      if (isGrouped && groupCardNumbers.has(rawGroupId)) {
        cardNumber = groupCardNumbers.get(rawGroupId)!;
      } else {
        cardNumber = await generateUniqueCardNumber(eventId);
        if (isGrouped) {
          groupCardNumbers.set(rawGroupId, cardNumber);
        }
      }

      guestsToInsert.push({
        name: g.name.trim(),
        phone: g.phone,
        title: g.title || '',
        cardNumber: cardNumber,
        guestType: guestType,
        guestCount: guestCount,
        cardGroupId: isGrouped ? rawGroupId : null,
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

    // ─── Deduct 1 credit per guest successfully imported (skip if bypass) ─
    if (!event.tenant?.bypassPayment && event.tenant?.creditsEnabled !== false && result.count > 0) {
      await prisma.tenant.update({
        where: { id: event.tenantId },
        data: { credits: { decrement: result.count } },
      });
      await prisma.usageRecord.createMany({
        data: Array.from({ length: result.count }, () => ({
          tenantId: event.tenantId,
          eventId,
          channel: 'guest_add',
          cost: 1,
        })),
      });
    }

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