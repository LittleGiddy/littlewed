// app/api/events/[eventId]/send-reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms/index'; // ✅ Keep this - NexSMS SMS
import { sendWhatsAppReminder } from '@/lib/whatsapp/index';
import { buildMchangoPersonalisation, getMchangoTemplate, MCHANGO_FIELDS, type MchangoOverrides } from '@/lib/whatsapp/mchango';
import { smsPartCount, MAX_SMS_PARTS_PER_GUEST, smsPartsError } from '@/lib/sms/units';
import { generateReminderCardForGuest } from '@/lib/image-storage';
import { sendPushToTenantRole } from '@/lib/push';
import { isCreditsDisabled, CREDITS_DISABLED_MESSAGE } from '@/lib/credits';
import { isContributionSettled } from '@/lib/contributions';

const REMINDER_COST = 50; // credits per reminder for the 3rd+ reminder
const FREE_REMINDERS_PER_GUEST = 2;

/** A guest is only billable once they've used up their free reminders. */
function isBillable(reminderCount: number): boolean {
  return reminderCount >= FREE_REMINDERS_PER_GUEST;
}

/**
 * Whitelist the client-supplied template overrides.
 *
 * The request body is attacker-controlled, so it is filtered down to the known
 * field keys, coerced to strings and length-capped. Without this the loop below
 * would build the personalisation from arbitrary user input with no bound.
 */
function sanitiseMchangoOverrides(input: unknown): MchangoOverrides {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const out: MchangoOverrides = {};
  for (const field of MCHANGO_FIELDS) {
    const value = source[field.key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    out[field.key] = String(value).slice(0, 400);
  }
  return out;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  const { eventId } = await params;
  const { guestIds, message, channel, variables } = await req.json();

  if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
    return NextResponse.json({ error: 'No guests selected' }, { status: 400 });
  }
  const chan = channel === 'whatsapp' ? 'whatsapp' : 'sms';
  if (chan === 'sms' && (!message || message.trim().length === 0)) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, tenantId },
    include: {
      tenant: {
        select: {
          credits: true,
          bypassPayment: true,
          creditsEnabled: true,
          name: true,
          whatsappAccount: true,
        },
      },
    },
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // ─── Once-per-event lock (non-bypassed tenants only) ───────────────
  if (!event.tenant.bypassPayment && event.manualReminderSent) {
    return NextResponse.json({
      error: 'Reminder messages can only be sent once per event. This event has already used its reminder. Bypassed (test/free) tenants are unlimited.',
    }, { status: 403 });
  }

  const guests = await prisma.guest.findMany({
    where: {
      id: { in: guestIds },
      eventId,
      phone: { not: null },
    },
    select: {
      id: true,
      name: true,
      title: true,
      phone: true,
      reminderCount: true,
      contribution: {
        select: { status: true, amountPaid: true, amountExpected: true },
      },
    },
  });

  // The guest list shows every guest, so the send honours the selection
  // verbatim. Routing only decides WHICH channel `chan` delivers over - it must
  // not silently drop a guest the user could see and tick, or the UI would
  // promise deliveries the request quietly discards.
  //
  // The one exception is a settled contribution: chasing someone who has
  // already paid in full wastes their money and the tenant's credits. The
  // picker hides these too, but the guard lives here so a stale client (or a
  // direct API call) cannot bypass it.
  const settledGuestIds = new Set(
    guests
      .filter((g) => event.contributionsEnabled && isContributionSettled(g.contribution))
      .map((g) => g.id)
  );
  const skippedSettled = guests.filter((g) => settledGuestIds.has(g.id));
  const targetGuests = guests.filter((g) => !settledGuestIds.has(g.id));
  if (targetGuests.length === 0) {
    // Distinguish "they all paid" from "nobody was reachable", because the
    // remedy is completely different and a bare 400 hides that.
    if (skippedSettled.length > 0) {
      return NextResponse.json(
        {
          error: `All ${skippedSettled.length} selected guest${skippedSettled.length > 1 ? 's have' : ' has'} already completed their contribution, so there is nobody left to remind.`,
          skippedSettled: skippedSettled.map((g) => g.id),
          settledCount: skippedSettled.length,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'No valid guests with phone numbers' }, { status: 400 });
  }

  // ─── Cost calculation ────────────────────────────────────────────────
  // First 2 reminders per guest are free; from the 3rd on it costs 50 credits.
  // Bypassed tenants and tenants with credits disabled are never charged here
  // (the disabled case is rejected just below).
  const willCharge = !event.tenant.bypassPayment && !isCreditsDisabled(event.tenant);
  const billableGuestIds = new Set(
    willCharge ? targetGuests.filter(g => isBillable(g.reminderCount)).map(g => g.id) : []
  );
  const totalCost = billableGuestIds.size * REMINDER_COST;

  const creditsDisabled = isCreditsDisabled(event.tenant);

  // Credits disabled overrides bypass-payment mode, so this rejects even for
  // tenants that would otherwise send for free.
  if (creditsDisabled && targetGuests.length > 0) {
    return NextResponse.json({
      error: CREDITS_DISABLED_MESSAGE,
      creditsNeeded: totalCost,
      creditsAvailable: 0,
      creditsDisabled: true,
    }, { status: 400 });
  }

  // ─── Hard cap on SMS parts (standard tenants only) ─────────────────────
  // Validated BEFORE any credits move, so an over-long SMS is rejected without
  // ever touching the balance. Bypassed tenants may send any length.
  if (chan === 'sms' && !event.tenant.bypassPayment) {
    const sampleMessage = message
      .replace(/\{name\}/g, 'Mr John Doe')
      .replace(/\{event\}/g, event.name);
    const sampleParts = smsPartCount(sampleMessage);
    if (sampleParts > MAX_SMS_PARTS_PER_GUEST) {
      return NextResponse.json({ error: smsPartsError(sampleParts) }, { status: 400 });
    }
  }

  if (willCharge && totalCost > 0) {
    // Reserve the full cost with ONE conditional update. Checking the balance
    // first and then decrementing separately lets two concurrent requests both
    // pass the check and overdraw the balance.
    const reserved = await prisma.tenant.updateMany({
      where: { id: tenantId, creditsEnabled: { not: false }, credits: { gte: totalCost } },
      data: { credits: { decrement: totalCost } },
    });

    if (reserved.count !== 1) {
      // Re-read so the message reflects the real balance.
      const fresh = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { credits: true },
      });
      return NextResponse.json({
        error: `Insufficient credits. Need ${totalCost} credits, you have ${fresh?.credits ?? 0}. Request more credits from the admin.`,
        creditsNeeded: totalCost,
        creditsAvailable: fresh?.credits ?? 0,
        creditsDisabled: false,
      }, { status: 400 });
    }
  }

  // ─── Send via chosen channel ─────────────────────────────────────────
  const whatsappTemplateName = getMchangoTemplate();
  // var1..var13 are event-level, so build the payload once and reuse it. The
  // per-guest personalisation is the reminder card header image.
  //
  // `variables` carries whatever the tenant typed in the editor. They override
  // the stored event values for this send only, so the message always matches
  // the preview they approved even if a save had not landed yet.
  const mchangoPersonalisation = buildMchangoPersonalisation(
    {
      name: event.name,
      eventType: event.eventType,
      hostFamily: event.hostFamily,
      person1: event.person1,
      person2: event.person2,
      venue: event.venue,
      address: event.address,
      date: event.date,
      contributionDeadline: event.contributionDeadline,
      mpesaInstructions: event.mpesaInstructions,
      airtelInstructions: event.airtelInstructions,
      bankInstructions: event.bankInstructions,
      contactPerson: event.contactPerson,
      contactPersonPhone: event.contactPersonPhone,
    },
    sanitiseMchangoOverrides(variables)
  );

  const results: Array<{ guestId: string; success: boolean; error?: string; charged: boolean }> = [];
  const sentAt = new Date();
  for (const guest of targetGuests) {
    // Charged up front for every billable guest; refunded below if this fails.
    const charged = billableGuestIds.has(guest.id);
    try {
      const phone = guest.phone as string;
      let sendResult: { success: boolean; error?: string };

      if (chan === 'whatsapp') {
        // Cards are composed to Cloudinary (same helper the invitation cards
        // use) and served as the template header image, which is what makes an
        // otherwise identical broadcast body feel personal.
        let cardUrl: string | undefined;
        if (event.reminderCardUrl) {
          try {
            cardUrl = await generateReminderCardForGuest(guest, event);
          } catch (cardError) {
            console.error(`[Reminders] Card composition failed for ${guest.name}:`, cardError);
            cardUrl = undefined;
          }
        }
        sendResult = await sendWhatsAppReminder({
          to: phone,
          personalisation: mchangoPersonalisation,
          templateName: whatsappTemplateName,
          cardUrl,
          account: event.tenant.whatsappAccount,
        });
      } else {
        const personalized = message
          .replace(/\{name\}/g, () => guest.name)
          .replace(/\{event\}/g, () => event.name);
        const parts = smsPartCount(personalized);
        if (!event.tenant.bypassPayment && parts > MAX_SMS_PARTS_PER_GUEST) {
          sendResult = { success: false, error: smsPartsError(parts) };
        } else {
          sendResult = await sendSMS({ to: phone, message: personalized });
        }
      }

      if (sendResult.success) {
        await prisma.guest.update({
          where: { id: guest.id },
          data: { reminderCount: { increment: 1 } },
        });

        // Open a contribution row on first reminder and stamp every send. This
        // is what populates the /[eventId]/contributions tracker and what makes
        // "stop reminding people who have paid" possible later.
        if (event.contributionsEnabled) {
          await prisma.contribution.upsert({
            where: { guestId: guest.id },
            create: {
              eventId,
              guestId: guest.id,
              status: 'PENDING',
              remindedAt: sentAt,
              remindedCount: 1,
            },
            update: { remindedAt: sentAt, remindedCount: { increment: 1 } },
          });
        }

        results.push({ guestId: guest.id, success: true, charged });
      } else {
        results.push({
          guestId: guest.id,
          success: false,
          error: sendResult.error || (chan === 'whatsapp' ? 'WhatsApp sending failed' : 'SMS sending failed'),
          charged,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ guestId: guest.id, success: false, error: msg, charged });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const errors = results.filter(r => !r.success).map(r => ({ guestId: r.guestId, error: r.error }));

  // ─── Refund guests that were charged but never delivered ──────────────
  // Credits are reserved before sending, so a provider failure must give the
  // money back. Otherwise a tenant pays for messages nobody received.
  const refundedCount = results.filter(r => !r.success && r.charged).length;
  const refundAmount = refundedCount * REMINDER_COST;

  if (refundAmount > 0) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { credits: { increment: refundAmount } },
    });
    await prisma.usageRecord.createMany({
      data: Array.from({ length: refundedCount }, () => ({
        tenantId,
        eventId,
        channel: `${chan}_reminder_refund`,
        cost: -REMINDER_COST,
      })),
    });
    console.warn(`[Reminders] Refunded ${refundAmount} credits for ${refundedCount} failed send(s)`);
  }

  // Record what was actually charged, so the usage ledger matches the balance.
  const chargedCount = results.filter(r => r.success && r.charged).length;
  if (chargedCount > 0) {
    await prisma.usageRecord.createMany({
      data: Array.from({ length: chargedCount }, () => ({
        tenantId,
        eventId,
        channel: `${chan}_reminder`,
        cost: REMINDER_COST,
      })),
    });
  }

  // Log every attempt so the WhatsApp delivery webhook can correlate a
  // reminder messageId. Without a MessageLog row the webhook can never match a
  // reminder, so delivery failures were invisible to the tenant.
  if (chan === 'whatsapp' && results.length > 0) {
    const successGuestIds = results.filter((r) => r.success).map((r) => r.guestId);
    const successPhones = new Map(
      targetGuests
        .filter((g) => successGuestIds.includes(g.id))
        .map((g) => [g.id, g.phone as string])
    );
    await prisma.messageLog
      .createMany({
        data: results.map((r, index) => ({
          // messageId is @unique and we do not always get one back, so fall
          // back to a deterministic local id rather than colliding on null.
          messageId: `reminder-${eventId}-${r.guestId}-${sentAt.getTime()}-${index}`,
          guestId: r.success ? r.guestId : null,
          type: 'WHATSAPP',
          template: whatsappTemplateName,
          status: r.success ? 'SENT' : 'FAILED',
          error: r.error ?? null,
          rawData: r.success
            ? { channel: 'whatsapp', to: successPhones.get(r.guestId) ?? null, source: 'send-reminders' }
            : { channel: 'whatsapp', source: 'send-reminders' },
        })),
      })
      .catch((logError) => {
        // Never fail a completed send because bookkeeping did not persist.
        console.error('[Reminders] MessageLog write failed:', logError);
      });
  }

  // Read the true balance back rather than deriving it, so the UI can never
  // show a number that disagrees with the database.
  const freshTenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { credits: true },
  });
  const remainingCredits = freshTenant?.credits ?? 0;

  if (successCount > 0) {
    await prisma.event.update({
      where: { id: eventId },
      data: { manualReminderSent: true },
    });

    sendPushToTenantRole(tenantId, 'CLIENT', {
      title: 'Reminders sent',
      body: `Reminder messages sent to ${successCount} guest${successCount > 1 ? 's' : ''} for ${event.name}.`,
      url: '/client/dashboard',
      type: 'success',
      sound: true,
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    successCount,
    // What was actually taken, after refunds - not the pre-send estimate.
    totalCost: totalCost - refundAmount,
    chargedCount,
    refundedCount,
    creditsRefunded: refundAmount,
    channel: chan,
    remainingCredits,
    // People skipped because they had already paid. The UI shows this so the
    // tenant understands the gap between "selected" and "sent".
    skippedSettledCount: skippedSettled.length,
    errors: errors.length > 0 ? errors : undefined,
    details: results,
  });
}