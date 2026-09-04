// app/api/events/[eventId]/thanks-card/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppThanksCard, getThanksWhatsAppTemplate } from '@/lib/whatsapp/index';
import { sendSMS } from '@/lib/sms/index';
import { guestTypeLabel } from '@/lib/guestTypes';
import { sendPushToTenantRole } from '@/lib/push';

const THANKS_COST_PER_MESSAGE = 300; // in TZS/credit units

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { eventId } = await params;

    const body = await req.json();
    const channel: 'whatsapp' | 'sms' = body.channel === 'sms' ? 'sms' : 'whatsapp';
    const whatsappCardUrl = body.whatsappCardUrl as string | undefined;
    const message = (body.message as string | undefined) || '';
    const includeAll = body.includeAll === true;

    const event = await prisma.event.findUnique({
      where: { id: eventId, tenantId },
      include: {
        tenant: { select: { credits: true, bypassPayment: true, creditsEnabled: true } },
        guests: {
          select: {
            id: true,
            name: true,
            title: true,
            phone: true,
            checkedIn: true,
            guestType: true,
            guestCount: true,
            cardNumber: true,
            thanksSentAt: true,
            smsThanksSentAt: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const isBypassed = event.tenant.bypassPayment;
    const creditsDisabled = event.tenant.creditsEnabled === false;
    const templateName = getThanksWhatsAppTemplate();

    // ─── Determine recipients ───────────────────────────────────────────
    // Thank all checked-in guests. Optionally include non-checked-in guests
    // when the user toggles "include all other guests". No channel filtering.
    const pool = includeAll
      ? event.guests
      : event.guests.filter((g) => g.checkedIn);

    const recipients = pool.filter(
      (g) => g.phone && (isBypassed || channel === 'whatsapp' ? !g.thanksSentAt : !g.smsThanksSentAt)
    );

    if (recipients.length === 0) {
      return NextResponse.json({
        success: true,
        successCount: 0,
        total: 0,
        skipped: pool.length,
        alreadyThanked: true,
        message: 'No more guests to thank on this channel.',
      });
    }

    // ─── Validation by channel ──────────────────────────────────────────
    if (channel === 'whatsapp' && !whatsappCardUrl) {
      return NextResponse.json(
        { error: 'A WhatsApp thanks card image is required to send WhatsApp thanks.' },
        { status: 400 }
      );
    }
    if (channel === 'sms' && !message.trim()) {
      return NextResponse.json(
        { error: 'A message is required to send SMS thanks.' },
        { status: 400 }
      );
    }

    // ─── Credit check + deduction (skip for bypass, blocked when disabled) ─
    const totalCost = recipients.length * THANKS_COST_PER_MESSAGE;
    if (!isBypassed || creditsDisabled) {
      const available = creditsDisabled ? 0 : (event.tenant.credits ?? 0);
      if (available < totalCost) {
        return NextResponse.json({
          error: creditsDisabled
            ? "Your account's credits have been disabled by the admin. Please contact support to re-enable them."
            : `Insufficient credits. Need ${totalCost} credits, you have ${event.tenant.credits}.`,
          creditsNeeded: totalCost,
          creditsAvailable: available,
          creditsDisabled,
        }, { status: 400 });
      }
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { credits: { decrement: totalCost } },
      });
    }

    // ─── Send thanks per guest on the chosen channel ────────────────────
    const results: {
      guestId: string;
      name: string;
      channel: string;
      success: boolean;
      error?: string;
    }[] = [];
    let successCount = 0;

    for (const g of recipients) {
      const fullName = g.title ? `${g.title} ${g.name}` : g.name;
      try {
        let sendResult: { success: boolean; error?: string; messageId?: string; data?: any };

        if (channel === 'whatsapp') {
          sendResult = await sendWhatsAppThanksCard({
            to: g.phone as string,
            cardUrl: whatsappCardUrl as string,
            templateName,
          });
        } else {
          const cardType = guestTypeLabel(g.guestType, g.guestCount);
          const personalized = message
            .replace(/\{guestName\}/g, () => fullName)
            .replace(/\{name\}/g, () => fullName)
            .replace(/\{cardNumber\}/g, () => g.cardNumber || '')
            .replace(/\{cardType\}/g, () => cardType)
            .replace(/\{event\}/g, () => event.name)
            .replace(/\{eventName\}/g, () => event.name);
          sendResult = await sendSMS({ to: g.phone as string, message: personalized });
        }

        if (sendResult.success) {
          successCount++;
          if (sendResult.messageId) {
            await prisma.messageLog.create({
              data: {
                messageId: sendResult.messageId,
                guestId: g.id,
                type: channel === 'whatsapp' ? 'WHATSAPP' : 'SMS',
                template: channel === 'whatsapp' ? templateName : 'thanks_sms',
                status: 'SENT',
                rawData: sendResult.data || {},
              },
            });
          }
          await prisma.guest.update({
            where: { id: g.id },
            data: channel === 'whatsapp' ? { thanksSentAt: new Date() } : { smsThanksSentAt: new Date() },
          });
          results.push({ guestId: g.id, name: g.name, channel, success: true });
        } else {
          results.push({
            guestId: g.id,
            name: g.name,
            channel,
            success: false,
            error: sendResult.error || (channel === 'whatsapp' ? 'WhatsApp sending failed' : 'SMS sending failed'),
          });
        }
      } catch (error: any) {
        results.push({
          guestId: g.id,
          name: g.name,
          channel,
          success: false,
          error: error.message || 'Unknown error',
        });
      }
    }

    const failed = results.filter((r) => !r.success);

    // ─── Notify the tenant owner(s) of the thanks activity ─────────────
    if (successCount > 0) {
      sendPushToTenantRole(tenantId, 'CLIENT', {
        title: 'Thanks messages sent',
        body: `Thanks ${channel === 'whatsapp' ? 'cards' : 'messages'} sent to ${successCount} guest${successCount > 1 ? 's' : ''} for ${event.name}.`,
        url: '/client/dashboard',
        type: 'success',
        sound: true,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      successCount,
      total: recipients.length,
      channel,
      isBypassed,
      errors: failed.length > 0 ? failed.map((r) => ({ guestId: r.guestId, name: r.name, error: r.error })) : undefined,
      details: results,
    });
  } catch (error: any) {
    console.error('Thanks card send error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send thanks messages' },
      { status: 500 }
    );
  }
}
