// app/api/invitations/send-whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWeddingInvitation, sendSendOffRsvpRequest, sendSendOffRsvpRequestNew, sendWeddingInvitationUkumbini } from '@/lib/whatsapp/index';
import { createRsvpPayload, RSVP_ACTIONS } from '@/lib/rsvp';
import { guestTypeLabel } from '@/lib/guestTypes';
import { checkAndChargeResendCredits, type ResendCreditCheck } from '@/lib/credits';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { guestId, eventId, resend } = await req.json();

    if (!guestId) {
      return NextResponse.json({ error: 'Guest ID is required' }, { status: 400 });
    }

    // ─── Fetch guest with event ──────────────────────────────────────────
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, event: { tenantId } },
      include: {
        event: {
          include: {
            tenant: { select: { bypassPayment: true, whatsappAccount: true } },
          },
        },
      },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    if (!guest.phone) {
      return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });
    }

    // The guest is already scoped to the tenant above, so its own event is
    // authoritative. Never trust a client-supplied eventId for the usage
    // ledger - it could point at another tenant's event.
    const resolvedEventId = guest.eventId || eventId;

    // ─── Routing guard (relaxed for resends) ─────────────────────────────
    // A guest routed to SMS can still be re-delivered over WhatsApp when the
    // user explicitly resends, so bypassed tenants are never restricted.
    const isResend = resend === true;
    if (guest.routingChannel !== 'whatsapp' && !isResend) {
      return NextResponse.json({
        error: `Guest is not configured for WhatsApp. Channel: ${guest.routingChannel}`,
      }, { status: 400 });
    }

    // ─── Once-per-channel guard (non-bypassed tenants) ───────────────────
    // Failed attempts never set whatsappSentAt, so failed invites can always
    // be retried. Bypassed tenants may resend freely. Standard tenants may
    // resend an already-delivered invitation only via `resend: true`, which
    // checks and consumes extra credits below.
    const isBypassed = guest.event?.tenant?.bypassPayment === true;
    if (!isBypassed && guest.whatsappSentAt && !isResend) {
      return NextResponse.json({
        error: 'This guest has already received their WhatsApp invitation (one invitation per guest per channel on your plan).',
      }, { status: 400 });
    }

    // ─── Extra-credit check for resends (standard tenants only) ──────────
    // Bypassed tenants resend for free and skip every check.
    let resendCreditInfo: ResendCreditCheck | undefined;
    if (!isBypassed && isResend && guest.whatsappSentAt) {
      const check = await checkAndChargeResendCredits(tenantId, resolvedEventId, 'whatsapp', 1);
      if (!check.allowed) {
        return NextResponse.json(check, { status: 400 });
      }
      resendCreditInfo = check;
    }

    // ─── Format date properly ──────────────────────────────────────────
    const formattedDate = guest.event?.date
      ? new Date(guest.event.date).toLocaleDateString('sw-TZ', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';

    // ─── Build guest full name ──────────────────────────────────────────
    const guestFullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;

    // ─── Build card image URL (Cloudinary-generated card; fallback to base image) ─
    const cardImageUrl = guest.invitationCard || guest.event?.imageUrl || '';

    // ─── Send WhatsApp invitation (no link button) ──────────────────────
    // Variable values come from the composer's settings saved on the account
    // (Event -> tenant), so a resend from another device repeats exactly what
    // this tenant typed. Event fields still fill anything left blank.
    const savedDraft = (guest.event?.whatsappInviteDraft ?? null) as {
      template?: string;
      vars?: Record<string, string>;
      contact?: string;
      contact2?: string;
      eventType?: string;
    } | null;
    const savedVars = savedDraft?.vars || {};
    const savedTemplateName =
      savedDraft?.template && savedDraft.template !== 'mwalikoplus'
        ? ({ mwalikoforth: 'MwalikoForth', mwaliko: 'Mwalikotemp', mwalikosecond: 'Mwalikosecond', sendofftemp: 'SandOffTemp', sendofftempnew: 'SendOffTempNew', mdakumbe: 'Event' } as Record<string, string>)[
            savedDraft.template
          ]
        : undefined;

    if (savedTemplateName === 'SandOffTemp' || savedTemplateName === 'SendOffTempNew') {
      const person1Name = savedVars.person1 || guest.event?.person1 || '';
      const person2Name = savedVars.person2 || guest.event?.person2 || '';
      const celebrant = person1Name && person2Name
        ? `${person1Name} na ${person2Name}`
        : person1Name || person2Name || '';

      const attendingPayload = createRsvpPayload(guest.id, RSVP_ACTIONS.ATTENDING);
      const declinedPayload = createRsvpPayload(guest.id, RSVP_ACTIONS.DECLINED);

      const rsvpData = {
        guestName: guest.name || '',
        eventType: savedDraft?.eventType || 'Send-Off',
        celebrant,
        date: savedVars.date || formattedDate,
        venue: savedVars.venue || guest.event?.venue || '',
        time: savedVars.time || guest.event?.time || '',
        cardNumber: guest.cardNumber || '',
        cardType: guestTypeLabel(guest.guestType, guest.guestCount),
        contact1: savedDraft?.contact || '',
        contact2: savedDraft?.contact2 || '',
        imageUrl: cardImageUrl || undefined,
        account: guest.event?.tenant?.whatsappAccount ?? undefined,
        attendingPayload,
        declinedPayload,
      };

      const sendOffResult =
        savedTemplateName === 'SendOffTempNew'
          ? await sendSendOffRsvpRequestNew(guest.phone, rsvpData)
          : await sendSendOffRsvpRequest(guest.phone, {
              ...rsvpData,
              hostFamily: savedVars.hostFamily || guest.event?.hostFamily || '',
              area: savedVars.area || guest.event?.address || '',
            });

      if (sendOffResult.success) {
        if (sendOffResult.messageId) {
          await prisma.messageLog.create({
            data: {
              messageId: sendOffResult.messageId,
              guestId: guest.id,
              type: 'WHATSAPP',
              template: savedTemplateName,
              status: 'SENT',
              rawData: sendOffResult.data,
            },
          });
        }

        await prisma.guest.update({
          where: { id: guest.id },
          data: { invitationSentAt: new Date(), whatsappSentAt: new Date(), lastSendStatus: 'SENT', lastSendError: null },
        });

        return NextResponse.json({
          success: true,
          message: 'Invitation sent successfully!',
          data: sendOffResult.data,
          messageId: sendOffResult.messageId,
          cardImageUrl,
          remainingCredits: resendCreditInfo?.creditsAvailable,
        });
      }

      if (sendOffResult.messageId) {
        await prisma.messageLog.create({
          data: {
            messageId: sendOffResult.messageId,
            guestId: guest.id,
            type: 'WHATSAPP',
            template: savedTemplateName,
            status: 'FAILED',
            error: sendOffResult.error || 'Unknown error',
            rawData: sendOffResult.data,
          },
        });
      }

      return NextResponse.json({
        success: false,
        error: sendOffResult.error || 'Failed to send WhatsApp message',
      }, { status: 500 });
    }

    // "Event" (Kadi ya Mualiko Ukumbini) is a fixed body - only {var1} (the
    // plain guest name, the greeting already says "Ndg.") and {var2} (card
    // number) vary. No URL button.
    if (savedTemplateName === 'Event') {
      const ukumbiniResult = await sendWeddingInvitationUkumbini(guest.phone, {
        guestName: guest.name || '',
        cardNumber: guest.cardNumber || '',
        imageUrl: cardImageUrl || undefined,
        account: guest.event?.tenant?.whatsappAccount ?? undefined,
      });
      if (ukumbiniResult.success) {
        if (ukumbiniResult.messageId) {
          await prisma.messageLog.create({
            data: {
              messageId: ukumbiniResult.messageId,
              guestId: guest.id,
              type: 'WHATSAPP',
              template: 'Event',
              status: 'SENT',
              rawData: ukumbiniResult.data,
            },
          });
        }

        await prisma.guest.update({
          where: { id: guest.id },
          data: { invitationSentAt: new Date(), whatsappSentAt: new Date(), lastSendStatus: 'SENT', lastSendError: null },
        });

        return NextResponse.json({
          success: true,
          message: 'Invitation sent successfully!',
          data: ukumbiniResult.data,
          messageId: ukumbiniResult.messageId,
          cardImageUrl,
          remainingCredits: resendCreditInfo?.creditsAvailable,
        });
      }

      if (ukumbiniResult.messageId) {
        await prisma.messageLog.create({
          data: {
            messageId: ukumbiniResult.messageId,
            guestId: guest.id,
            type: 'WHATSAPP',
            template: 'Event',
            status: 'FAILED',
            error: ukumbiniResult.error || 'Unknown error',
            rawData: ukumbiniResult.data,
          },
        });
      }

      return NextResponse.json({
        success: false,
        error: ukumbiniResult.error || 'Failed to send WhatsApp message',
      }, { status: 500 });
    }

    const result = await sendWeddingInvitation(guest.phone, {
      guestName: guestFullName,
      hostFamily: savedVars.hostFamily || guest.event?.hostFamily || '',
      person1: savedVars.person1 || guest.event?.person1 || '',
      person2: savedVars.person2 || guest.event?.person2 || '',
      date: savedVars.date || formattedDate,
      venue: savedVars.venue || guest.event?.venue || '',
      time: savedVars.time || guest.event?.time || '',
      cardNumber: guest.cardNumber || '',
      cardType: guestTypeLabel(guest.guestType, guest.guestCount),
      imageUrl: cardImageUrl || undefined,  // ✅ Card image rendered in WhatsApp (omitted if none)
      // No inviteLink - removed!
      // Use the tenant's NexSMS account; a wrong/blank account makes the
      // provider reject every send with HTTP 422.
      templateName: savedTemplateName,
      contact: savedDraft?.contact,
      eventType: savedDraft?.eventType,
      account: guest.event?.tenant?.whatsappAccount ?? undefined,
    });

    if (result.success) {
      // ─── Create MessageLog for tracking ──────────────────────────────
      if (result.messageId) {
        await prisma.messageLog.create({
          data: {
            messageId: result.messageId,
            guestId: guest.id,
            type: 'WHATSAPP',
            template: 'swahili invitation',
            status: 'SENT',
            rawData: result.data,
          },
        });
      }

      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationSentAt: new Date(), whatsappSentAt: new Date(), lastSendStatus: 'SENT', lastSendError: null },
      });

      return NextResponse.json({
        success: true,
        message: 'Invitation sent successfully!',
        data: result.data,
        messageId: result.messageId,
        cardImageUrl,
        remainingCredits: resendCreditInfo?.creditsAvailable,
      });
    } else {
      // ─── Log the failure ──────────────────────────────────────────────
      console.error('[WhatsApp] Failed to send to', guest.phone, result.error);
      
      if (result.messageId) {
        await prisma.messageLog.create({
          data: {
            messageId: result.messageId,
            guestId: guest.id,
            type: 'WHATSAPP',
            template: 'swahili invitation',
            status: 'FAILED',
            error: result.error || 'Unknown error',
            rawData: result.data,
          },
        });
      }

      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send WhatsApp message',
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Send WhatsApp error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}