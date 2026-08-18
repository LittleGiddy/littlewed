// app/api/invitations/send-sms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms';

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
      include: { event: true },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    if (!guest.phone) {
      return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });
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
    let smsMessage = `Habari ${guestFullName},

Familia ya ${guest.event?.hostFamily || 'Mr & Mrs Allan Swai'} inakualika katika harusi ya ${guest.event?.person1 || 'Agape'} na ${guest.event?.person2 || 'Gladness'} tarehe ${formattedDate}.

Venue: ${guest.event?.venue || 'The Embassy Hall'}, saa ${guest.event?.time || '5:00 PM'}.

Card No: ${guest.cardNumber || '108'} • ${guest.guestType || 'SINGLE'}

Tafadhali onyesha kadi hii wakati wa kuingia.
Karibu na ufurahie sherehe!

Ahsante.`;

    // ─── If custom message provided, use it ─────────────────────────────
    if (message) {
      smsMessage = message
        .replace(/{title}/g, guest.title || '')
        .replace(/{name}/g, guest.name)
        .replace(/{fullName}/g, guestFullName)
        .replace(/{cardNumber}/g, guest.cardNumber || 'N/A')
        .replace(/{passCode}/g, guest.passCode || 'N/A')
        .replace(/{event}/g, guest.event?.name || '')
        .replace(/{date}/g, formattedDate)
        .replace(/{venue}/g, guest.event?.venue || '')
        .replace(/{address}/g, guest.event?.address || '')
        .replace(/{hostFamily}/g, guest.event?.hostFamily || '')
        .replace(/{person1}/g, guest.event?.person1 || '')
        .replace(/{person2}/g, guest.event?.person2 || '')
        .replace(/{time}/g, guest.event?.time || '');
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
        data: { invitationSentAt: new Date() },
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