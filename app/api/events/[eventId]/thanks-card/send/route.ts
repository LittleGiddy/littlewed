// app/api/events/[eventId]/thanks-card/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms/index';
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

    const { smsTemplate, smsVariables, whatsappCardUrl } = await req.json();

    const event = await prisma.event.findUnique({
      where: { id: eventId, tenantId },
      include: {
        tenant: { select: { credits: true, bypassPayment: true } },
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
    const templateName = getThanksWhatsAppTemplate();

    // ─── Determine which guests will actually be sent to ────────────────
    // Non-bypassed accounts can send Thanks only ONCE per guest (guarded by
    // thanksSentAt). Bypassed accounts have no limit.
    const targets = event.guests.filter(
      (g) => g.phone && (isBypassed || !g.thanksSentAt)
    );

    const whatsappTargets = targets.filter((g) => g.routingChannel === 'whatsapp');
    const smsTargets = targets.filter((g) => g.routingChannel === 'sms');

    // ─── Validate prerequisites per channel ─────────────────────────────
    if (whatsappTargets.length > 0 && !whatsappCardUrl) {
      return NextResponse.json(
        { error: 'A WhatsApp thanks card image is required to send to WhatsApp guests.' },
        { status: 400 }
      );
    }
    if (smsTargets.length > 0 && !smsTemplate?.trim()) {
      return NextResponse.json(
        { error: 'An SMS thanks message is required to send to SMS guests.' },
        { status: 400 }
      );
    }

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        successCount: 0,
        skipped: event.guests.length,
        alreadyThanksCalledOut: true,
        message: event.guests.length > 0
          ? 'All checked-in guests have already been thanked.'
          : 'No checked-in guests to thank.',
      });
    }

    // ─── Credit check + deduction (skip for bypass) ────────────────────
    const totalCost = targets.length * THANKS_COST_PER_MESSAGE;
    if (!isBypassed) {
      if ((event.tenant.credits ?? 0) < totalCost) {
        return NextResponse.json({
          error: `Insufficient credits. Need ${totalCost} credits, you have ${event.tenant.credits}.`,
          creditsNeeded: totalCost,
          creditsAvailable: event.tenant.credits,
        }, { status: 400 });
      }
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { credits: { decrement: totalCost } },
      });
    }

    // ─── Format helpers ────────────────────────────────────────────────
    const formattedDate = new Date(event.date).toLocaleDateString('sw-TZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const vars = smsVariables || {};

    const buildSmsThanks = (g: any) => {
      const fullName = g.title ? `${g.title} ${g.name}` : g.name;
      const map: Record<string, string> = {
        guestName: fullName,
        name: g.name || '',
        title: g.title || '',
        fullName,
        cardNumber: g.cardNumber || '',
        cardNo: g.cardNumber || '',
        guestType: g.guestType === 'DOUBLE' ? 'Double' : 'Single',
        hostFamily: vars.hostFamily || event.hostFamily || '',
        person1: vars.person1 || event.person1 || '',
        person2: vars.person2 || event.person2 || '',
        eventDate: formattedDate,
        date: formattedDate,
        venue: vars.venue || event.venue || '',
        time: vars.time || event.time || '',
      };
      return smsTemplate.replace(
        /\{(guestName|name|title|fullName|cardNumber|cardNo|guestType|hostFamily|person1|person2|eventDate|date|venue|time)\}/g,
        (m: string, key: string) => map[key] ?? m
      );
    };

    // ─── Send ──────────────────────────────────────────────────────────
    const results: {
      guestId: string;
      name: string;
      channel: string;
      success: boolean;
      error?: string;
    }[] = [];
    let successCount = 0;
    const skipped = event.guests.length - targets.length;

    // WhatsApp: same single card to every WhatsApp checked-in guest.
    for (const g of whatsappTargets) {
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

    // SMS: personalized thanks message to every SMS checked-in guest.
    for (const g of smsTargets) {
      try {
        const smsMessage = buildSmsThanks(g);
        const result = await sendSMS({ to: g.phone as string, message: smsMessage });
        if (result.success) {
          successCount++;
          if (result.messageId) {
            await prisma.messageLog.create({
              data: {
                messageId: result.messageId,
                guestId: g.id,
                type: 'SMS',
                template: 'thanks',
                status: 'SENT',
                rawData: result.data || {},
              },
            });
          }
          await prisma.guest.update({
            where: { id: g.id },
            data: { thanksSentAt: new Date() },
          });
          results.push({ guestId: g.id, name: g.name, channel: 'sms', success: true });
        } else {
          results.push({ guestId: g.id, name: g.name, channel: 'sms', success: false, error: result.error });
        }
      } catch (error: any) {
        results.push({ guestId: g.id, name: g.name, channel: 'sms', success: false, error: error.message });
      }
    }

    const failed = results.filter((r) => !r.success);

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
      total: targets.length,
      skipped,
      isBypassed,
      whatsapp: whatsappTargets.length,
      sms: smsTargets.length,
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
