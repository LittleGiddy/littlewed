// app/api/invitations/send-template/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWeddingInvitation } from '@/lib/whatsapp/index';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { guestId, eventId } = await req.json();

    if (!guestId || !eventId) {
      return NextResponse.json({ error: 'Guest ID and Event ID are required' }, { status: 400 });
    }

    // ─── Fetch guest and event ──────────────────────────────────────────
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, event: { tenantId } },
    });

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!guest || !event) {
      return NextResponse.json({ error: 'Guest or Event not found' }, { status: 404 });
    }

    if (!guest.phone) {
      return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });
    }

    if (guest.routingChannel !== 'whatsapp') {
      return NextResponse.json({
        error: `Guest is not configured for WhatsApp. Channel: ${guest.routingChannel}`,
      }, { status: 400 });
    }

    // ─── Format date properly ──────────────────────────────────────────
    const formattedDate = new Date(event.date).toLocaleDateString('sw-TZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // ─── Build guest full name with title ──────────────────────────────
    const guestFullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;

    // ─── Build host family name ─────────────────────────────────────────
    const hostFamily = event.hostFamily || 'Mr & Mrs Wambura';

    // ─── Build person names (groom and bride) ──────────────────────────
    const person1 = event.person1 || 'John Wambura';
    const person2 = event.person2 || 'Mary Wambura';

    // ─── Send WhatsApp invitation ──────────────────────────────────────
    const result = await sendWeddingInvitation(guest.phone, {
      guestName: guestFullName,           // ✅ var1: "Mr Gideon"
      hostFamily: hostFamily,             // ✅ var2: "Mr & Mrs Wambura"
      person1: person1,                   // ✅ var3: "John Wambura"
      person2: person2,                   // ✅ var4: "Mary Wambura"
      date: formattedDate,                // ✅ var5: "25 Oktoba, 2026"
      venue: event.venue || 'TAZARA',     // ✅ var6: "TAZARA"
      time: event.time || '5:00 PM',      // ✅ var7: "5:00 PM"
      cardNumber: guest.cardNumber || '11092', // ✅ var8: "11092"
      cardType: guest.guestType || 'SINGLE',   // ✅ var9: "SINGLE"
      imageUrl: guest.invitationCard || event.imageUrl || 'https://www.gstatic.com/webp/gallery/1.png',
      inviteLink: `https://littlewed.co.tz/invite/${guest.id}`,
    });

    if (result.success) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationSentAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: 'Invitation sent successfully!',
        data: result.data,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Send template error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}