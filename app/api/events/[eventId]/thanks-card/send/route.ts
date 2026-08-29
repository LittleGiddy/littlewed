// app/api/events/[eventId]/thanks-card/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppThanksCard, getThanksWhatsAppTemplate } from '@/lib/whatsapp/index';
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

    const { whatsappCardUrl } = await req.json();

    const event = await prisma.event.findUnique({
      where: { id: eventId, tenantId },
      include: {
        tenant: { select: { credits: true, bypassPayment: true, creditsEnabled: true } },
        guests: {
          where: { checkedIn: true },
          select: {
            id: true,
            name: true,
            title: true,
            phone: true,
            routingChannel: true,
            guestType: true,
            cardNumber: true,
            thanksSentAt: true,
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

    // ─── Determine which guests will actually be sent to ────────────────
    // Thanks cards are WhatsApp-only. Non-bypassed accounts can send Thanks
    // only ONCE per guest (guarded by thanksSentAt). Bypassed have no limit.
    const whatsappGuests = event.guests.filter(
      (g) => g.routingChannel === 'whatsapp' && g.phone && (isBypassed || !g.thanksSentAt)
    );
    const smsSkipped = event.guests.filter((g) => g.routingChannel === 'sms').length;

    if (whatsappGuests.length > 0 && !whatsappCardUrl) {
      return NextResponse.json(
        { error: 'A WhatsApp thanks card image is required to send to WhatsApp guests.' },
        { status: 400 }
      );
    }

    if (whatsappGuests.length === 0) {
      return NextResponse.json({
        success: true,
        successCount: 0,
        skipped: event.guests.length,
        alreadyThanksCalledOut: true,
        message: smsSkipped > 0
          ? 'Thanks cards are sent via WhatsApp only - no WhatsApp checked-in guests to thank.'
          : 'No checked-in WhatsApp guests to thank.',
      });
    }

    // ─── Credit check + deduction (skip for bypass, blocked when disabled) ─
    const totalCost = whatsappGuests.length * THANKS_COST_PER_MESSAGE;
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

    // ─── Send: same single card to every WhatsApp checked-in guest ──────
    const results: {
      guestId: string;
      name: string;
      channel: string;
      success: boolean;
      error?: string;
    }[] = [];
    let successCount = 0;

    for (const g of whatsappGuests) {
      try {
        const result = await sendWhatsAppThanksCard({
          to: g.phone as string,
          cardUrl: whatsappCardUrl,
          templateName,
        });
        if (result.success) {
          successCount++;
          if (result.messageId) {
            await prisma.messageLog.create({
              data: {
                messageId: result.messageId,
                guestId: g.id,
                type: 'WHATSAPP',
                template: templateName,
                status: 'SENT',
                rawData: result.data || {},
              },
            });
          }
          await prisma.guest.update({
            where: { id: g.id },
            data: { thanksSentAt: new Date() },
          });
          results.push({ guestId: g.id, name: g.name, channel: 'whatsapp', success: true });
        } else {
          results.push({ guestId: g.id, name: g.name, channel: 'whatsapp', success: false, error: result.error });
        }
      } catch (error: any) {
        results.push({ guestId: g.id, name: g.name, channel: 'whatsapp', success: false, error: error.message });
      }
    }

    const failed = results.filter((r) => !r.success);
    const skipped = event.guests.length - whatsappGuests.length;

    // ─── Notify the tenant owner(s) of the thanks activity ─────────────
    sendPushToTenantRole(tenantId, 'CLIENT', {
      title: 'Thanks cards sent',
      body: `Thanks messages sent to ${successCount} checked-in guest${successCount > 1 ? 's' : ''} for ${event.name}.`,
      url: '/client/dashboard',
      type: 'success',
      sound: true,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      successCount,
      total: whatsappGuests.length,
      skipped,
      isBypassed,
      whatsapp: whatsappGuests.length,
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