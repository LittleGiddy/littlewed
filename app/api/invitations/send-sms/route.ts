// app/api/invitations/send-sms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms';
import { guestTypeLabel } from '@/lib/guestTypes';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { guestId, eventId, message } = await req.json();

    if (!guestId || !eventId) {
      return NextResponse.json({ error: 'Guest ID and Event ID are required' }, { status: 400 });
    }

    // ─── Fetch guest with event ──────────────────────────────────────────
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, event: { tenantId } },
      include: {
        event: {
          include: {
            tenant: { select: { bypassPayment: true } },
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

    // ─── Once-per-channel guard (non-bypassed tenants) ───────────────────
    // Failed attempts never set smsSentAt, so failed invites can always be
    // retried. Bypassed tenants may resend freely.
    const isBypassed = guest.event?.tenant?.bypassPayment === true;
    if (!isBypassed && guest.smsSentAt) {
      return NextResponse.json({
        error: 'This guest has already received their SMS invitation (one invitation per guest per channel on your plan).',
      }, { status: 400 });
    }

    // ─── Build guest full name ──────────────────────────────────────────
    const guestFullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
    const formattedDate = guest.event?.date
      ? new Date(guest.event.date).toLocaleDateString('sw-TZ', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';

    // ─── Build SMS message (no link) ────────────────────────────────────
    // Values come from the user's event/guest data - no hardcoded fallbacks.
    let smsMessage = `Habari ${guestFullName},

Familia ya ${guest.event?.hostFamily || ''} inakualika katika harusi ya ${guest.event?.person1 || ''} na ${guest.event?.person2 || ''} tarehe ${formattedDate}.

Venue: ${guest.event?.venue || ''}, saa ${guest.event?.time || ''}.

Card No: ${guest.cardNumber || ''} • ${guestTypeLabel(guest.guestType, guest.guestCount)}

Tafadhali onyesha kadi hii wakati wa kuingia.
Karibu na ufurahie sherehe!

Ahsante.`;

    // ─── If custom message provided, use it ─────────────────────────────
    if (message) {
      // Function-based replace: guarantees full values and avoids any
      // `$&`/`$'`/`$\`` corruption that string replacement can introduce.
      const varsMap: Record<string, string> = {
        title: guest.title || '',
        name: guest.name || '',
        fullName: guestFullName,
        guestName: guestFullName,
        cardNumber: guest.cardNumber || 'N/A',
        cardType: guestTypeLabel(guest.guestType, guest.guestCount),
        guestType: guestTypeLabel(guest.guestType, guest.guestCount),
        passCode: guest.passCode || 'N/A',
        event: guest.event?.name || '',
        date: formattedDate,
        venue: guest.event?.venue || '',
        address: guest.event?.address || '',
        hostFamily: guest.event?.hostFamily || '',
        person1: guest.event?.person1 || '',
        person2: guest.event?.person2 || '',
        time: guest.event?.time || '',
      };
      smsMessage = message.replace(
        /\{(title|name|fullName|guestName|cardNumber|cardType|guestType|passCode|event|date|venue|address|hostFamily|person1|person2|time)\}/g,
        (match: string, key: string) => varsMap[key] ?? match
      );
    }

    // ─── Send SMS ──────────────────────────────────────────────────────
    const result = await sendSMS({
      to: guest.phone,
      message: smsMessage,
    });

    if (result.success) {
      // ─── Create MessageLog for tracking ──────────────────────────────
      if (result.messageId) {
        await prisma.messageLog.create({
          data: {
            messageId: result.messageId,
            guestId: guest.id,
            type: 'SMS',
            template: 'custom',
            status: 'SENT',
            rawData: result.data,
          },
        });
      }

      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationSentAt: new Date(), smsSentAt: new Date(), lastSendStatus: 'SENT', lastSendError: null },
      });

      return NextResponse.json({
        success: true,
        message: 'SMS sent successfully!',
        data: result.data,
        messageId: result.messageId,
      });
    } else {
      // ─── Log the failure ──────────────────────────────────────────────
      console.error('[SMS] Failed to send to', guest.phone, result.error);

      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send SMS',
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Send SMS error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}