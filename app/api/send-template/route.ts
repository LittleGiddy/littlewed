// app/api/invitations/send-template/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppTemplate } from '@/lib/messaging';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guestId, eventId, template, personalisation } = await req.json();

    if (!guestId || !eventId || !template) {
      return NextResponse.json({ error: 'Missing guestId, eventId, or template' }, { status: 400 });
    }

    const guest = await prisma.guest.findFirst({
      where: { id: guestId },
      include: { event: true },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    if (!guest.phone) {
      return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });
    }

    // ✅ Send WhatsApp template using NexSMS
    const result = await sendWhatsAppTemplate({
      to: guest.phone,
      template: template,
      personalisation: personalisation || [{ "1": guest.name }],
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Update guest record
    await prisma.guest.update({
      where: { id: guestId },
      data: { invitationSentAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'WhatsApp template sent successfully',
    });
  } catch (error: any) {
    console.error('Send WhatsApp template error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send WhatsApp template' },
      { status: 500 }
    );
  }
}