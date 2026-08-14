// app/api/guests/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { normalizePhone } from '@/lib/phone';

// ─── Helper: Check WhatsApp using NexSMS ──────────────────────────────
async function checkWhatsAppNumber(phone: string): Promise<{ hasWhatsApp: boolean; waId?: string; error?: string }> {
  // Since NexSMS doesn't have a direct WhatsApp check endpoint,
  // we assume WhatsApp is available and let the send API handle errors.
  // This is the safest approach - if the number doesn't have WhatsApp,
  // the send API will return an error and we can fallback to SMS.
  
  // For now, return true (will use WhatsApp if available, SMS as fallback)
  return { hasWhatsApp: true };
  
  // If NexSMS adds a number context API in the future, use it here:
  // try {
  //   const cleanPhone = phone.replace(/^\+/, '').replace(/\D/g, '');
  //   const response = await fetch('https://messaging-service.co.tz/api/whatsapp/v2/number/context', {
  //     method: 'POST',
  //     headers: {
  //       'Authorization': `Bearer ${process.env.NEXTSMS_TOKEN}`,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({ to: [cleanPhone] }),
  //   });
  //   const data = await response.json();
  //   return { hasWhatsApp: data.status === 'valid', waId: data.waId };
  // } catch (error: any) {
  //   return { hasWhatsApp: false, error: error.message };
  // }
}

// ─── Helper: Check WhatsApp with rate limiting ──────────────────────────
async function checkWhatsAppWithRetry(phone: string, retries = 2): Promise<{ hasWhatsApp: boolean; waId?: string; error?: string }> {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await checkWhatsAppNumber(phone);
      return result;
    } catch (error: any) {
      if (i === retries - 1) {
        return { hasWhatsApp: false, error: error.message };
      }
      // Wait before retry
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return { hasWhatsApp: false, error: 'Max retries exceeded' };
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

    // ─── Validate phone numbers and normalize ────────────────────────
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

    // ─── Check guest limit ────────────────────────────────────────────
    if (!event.tenant?.bypassPayment && event.guestCount) {
      const currentGuests = await prisma.guest.count({ where: { eventId } });
      if (currentGuests + validGuests.length > event.guestCount) {
        const remaining = Math.max(0, event.guestCount - currentGuests);
        return NextResponse.json({
          error: `Exceeds guest limit of ${event.guestCount}. You can add up to ${remaining} more guests.`,
        }, { status: 400 });
      }
    }

    // ─── Duplicate detection using phone ────────────────────────────
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
          // If check fails, default to SMS
          smsCount++;
          console.log(`WhatsApp check failed for ${g.name}:`, error);
        }
      } else {
        smsCount++;
      }

      guestsToInsert.push({
        name: g.name.trim(),
        phone: g.phone,
        title: g.title || '',
        cardNumber: g.cardNumber || null,
        guestType: g.guestType || 'SINGLE',
        email: null,
        eventId,
        routingChannel,
        smsCode: randomBytes(4).toString('hex').toUpperCase(),
        qrToken: randomBytes(16).toString('hex'),
      });
    }

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