import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ─── NexSMS Configuration ──────────────────────────────────────────────
const NEXTSMS_API_URL = 'https://messaging-service.co.tz/api/whatsapp/v2/text/single';
const NEXTSMS_TOKEN = process.env.NEXTSMS_TOKEN;
const NEXTSMS_ACCOUNT = process.env.NEXTSMS_ACCOUNT || 'TANZANIATIP';
const isMock = process.env.MOCK_SMS === 'true';

// ─── Helper: Get formatted guest name ──────────────────────────────────
function getGuestFullName(guest: any): string {
  const title = guest.title || 'Mr';
  return `${title} ${guest.name}`;
}

// ─── Helper: Send WhatsApp via NexSMS ──────────────────────────────────
async function sendWhatsAppViaNexSMS(params: {
  to: number;
  template: string;
  personalisation?: Record<string, string>[];
  header?: {
    image?: { file: string; name?: string };
    document?: { file: string; name?: string };
  };
  button?: { url: string };
}) {
  const { to, template, personalisation, header, button } = params;

  const body: any = {
    to: [to],
    account: NEXTSMS_ACCOUNT,
    template: template,
  };

  if (personalisation) {
    body.personalisation = personalisation;
  }

  if (header) {
    body.header = header;
  }

  if (button) {
    body.button = button;
  }

  const response = await fetch(NEXTSMS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${NEXTSMS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to send WhatsApp message');
  }

  return data;
}

// ─── GET: List guests ────────────────────────────────────────────────────
// app/api/invitations/send-whatsapp/route.ts

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { guestId, eventId, type, template, imageUrl, buttonUrl } = await req.json();

    if (!guestId || !eventId) {
      return NextResponse.json({ error: 'Missing guestId or eventId' }, { status: 400 });
    }

    // ─── Fetch guest and event ──────────────────────────────────────────
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, event: { tenantId } },
      include: { 
        event: {
          include: {
            tenant: {
              select: { 
                bypassPayment: true,
              }
            }
          }
        }
      },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    if (!guest.phone) {
      return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });
    }

    if (!guest.invitationCard) {
      return NextResponse.json(
        { error: 'No invitation card generated for this guest. Please generate it first.' },
        { status: 400 }
      );
    }

    // ─── Prepare template and variables ──────────────────────────────────
    const fullName = getGuestFullName(guest);
    const event = guest.event;
    const templateName = template || 'event_invitation';

    const personalisation = [
      {
        "1": fullName,
        "2": (event as any).hostFamily || 'Mr & Mrs Allan Swai',
        "3": (event as any).person1 || 'Agape',
        "4": (event as any).person2 || 'Gladness',
        "5": event.date ? new Date(event.date).toLocaleDateString('sw-TZ', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        }) : '8 Agosti 2026',
        "6": (event as any).venue || 'The Embassy Hall, Kwamsuguri, Mbezi Louis',
        "7": (event as any).time || '5:00 PM',
        "8": guest.cardNumber || '108',
        "9": guest.guestType || 'SINGLE',
      }
    ];

    // ─── Prepare header (image) ──────────────────────────────────────────
    const headerImage = imageUrl || guest.invitationCard;
    const header = headerImage ? {
      image: {
        file: headerImage,
        name: 'Wedding Invitation',
      }
    } : undefined;

    // ─── Prepare button (URL) ────────────────────────────────────────────
    const buttonUrlFinal = buttonUrl || `https://littlewed.co.tz/invite/${guest.id}`;
    const button = {
      url: buttonUrlFinal,
    };

    // ─── Send WhatsApp via NexSMS ───────────────────────────────────────
    if (isMock) {
      console.log(`[MOCK] WhatsApp to ${guest.phone}: Template: ${templateName}`);
      console.log(`[MOCK] Personalisation:`, personalisation);
      console.log(`[MOCK] Header:`, header);
      console.log(`[MOCK] Button:`, button);
    } else {
      const phoneNumber = parseInt(guest.phone.replace(/^\+/, ''));
      
      await sendWhatsAppViaNexSMS({
        to: phoneNumber,
        template: templateName,
        personalisation,
        header,
        button,
      });
    }

    // ─── Update guest record ─────────────────────────────────────────────
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        invitationSentAt: new Date(),
        ...(type === 'thanks' ? { thanksSentAt: new Date() } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'WhatsApp message sent successfully',
    });
  } catch (error: any) {
    console.error('Send WhatsApp error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send WhatsApp message' },
      { status: 500 }
    );
  }
}