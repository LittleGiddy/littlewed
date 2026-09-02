// app/api/events/[eventId]/send-reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms/index'; // ✅ Keep this - NexSMS SMS
import { sendWhatsAppReminder, getReminderWhatsAppTemplate } from '@/lib/whatsapp/index';
import { generateReminderCardForGuest } from '@/lib/image-storage';
import { sendPushToTenantRole } from '@/lib/push';

const REMINDER_COST = 50; // credits per reminder for the 3rd+ reminder

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
  const { guestIds, message, channel } = await req.json();

  if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
    return NextResponse.json({ error: 'No guests selected' }, { status: 400 });
  }
  const chan = channel === 'whatsapp' ? 'whatsapp' : 'sms';
  if (chan === 'sms' && (!message || message.trim().length === 0)) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, tenantId },
    include: { tenant: { select: { credits: true, bypassPayment: true, creditsEnabled: true } } },
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
    select: { id: true, name: true, title: true, phone: true, reminderCount: true, routingChannel: true },
  });

  if (guests.length === 0) {
    return NextResponse.json({ error: 'No valid guests with phone numbers' }, { status: 400 });
  }

  // Filter to guests matching the chosen channel
  const channelGuests = chan === 'whatsapp'
    ? guests.filter(g => g.routingChannel === 'whatsapp')
    : guests.filter(g => g.routingChannel === 'sms');
  if (channelGuests.length === 0) {
    return NextResponse.json({
      error: `No ${chan === 'whatsapp' ? 'WhatsApp' : 'SMS'} guests selected for this reminder.`,
    }, { status: 400 });
  }

  // Calculate cost in credits: first 2 reminders per guest free, then 50 credits each
  let totalCost = 0;
  for (const g of channelGuests) {
    totalCost += g.reminderCount < 2 ? 0 : REMINDER_COST;
  }

  const creditsDisabled = event.tenant.creditsEnabled === false;

  if (totalCost > 0 && (!event.tenant.bypassPayment || creditsDisabled)) {
    const available = creditsDisabled ? 0 : (event.tenant.credits ?? 0);
    if (available < totalCost) {
      return NextResponse.json({
        error: creditsDisabled
          ? "Your account's credits have been disabled by the admin. Please contact support to re-enable them."
          : `Insufficient credits. Need ${totalCost} credits, you have ${event.tenant.credits}. Request more credits from the admin.`,
        creditsNeeded: totalCost,
        creditsAvailable: available,
        creditsDisabled,
      }, { status: 400 });
    }
  }

  // Deduct credits (skip if bypassPayment)
  if (totalCost > 0 && !event.tenant.bypassPayment && event.tenant.creditsEnabled !== false) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { credits: { decrement: totalCost } },
    });
  }

  const remainingCredits = event.tenant.bypassPayment
    ? event.tenant.credits
    : (event.tenant.credits ?? 0) - totalCost;

  // ─── Send via chosen channel ─────────────────────────────────────────
  const whatsappTemplateName = getReminderWhatsAppTemplate();
  const results = [];
  for (const guest of channelGuests) {
    try {
      const phone = guest.phone as string;
      let sendResult: { success: boolean; error?: string };

      if (chan === 'whatsapp') {
        const fullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
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
          guestName: fullName,
          templateName: whatsappTemplateName,
          cardUrl,
        });
      } else {
        const personalized = message
          .replace(/{name}/g, guest.name)
          .replace(/{event}/g, event.name);
        sendResult = await sendSMS({ to: phone, message: personalized });
      }

      if (sendResult.success) {
        await prisma.guest.update({
          where: { id: guest.id },
          data: { reminderCount: { increment: 1 } },
        });
        results.push({ guestId: guest.id, success: true });
      } else {
        results.push({
          guestId: guest.id,
          success: false,
          error: sendResult.error || (chan === 'whatsapp' ? 'WhatsApp sending failed' : 'SMS sending failed'),
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ guestId: guest.id, success: false, error: msg });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const errors = results.filter(r => !r.success).map(r => ({ guestId: r.guestId, error: r.error }));

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
    totalCost,
    channel: chan,
    remainingCredits,
    errors: errors.length > 0 ? errors : undefined,
    details: results,
  });
}