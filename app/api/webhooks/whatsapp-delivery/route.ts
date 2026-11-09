// app/api/webhooks/whatsapp-delivery/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  actionFromButtonLabel,
  RSVP_STATUS_BY_ACTION,
  verifyRsvpPayload,
} from '@/lib/rsvp';

const WEBHOOK_VERIFY_TOKEN = process.env.NEXTSMS_WEBHOOK_TOKEN;

interface WhatsAppCallback {
  token?: string;
  messageId?: string | number;
  status?: string;
  payload?: string;
  response?: string;
  text?: string;
  error?: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WhatsAppCallback;

    console.log('[Webhook] ====== Received WhatsApp callback ======');
    console.log('[Webhook] Payload:', JSON.stringify(body, null, 2));

    if (!WEBHOOK_VERIFY_TOKEN) {
      console.error('[Webhook] ❌ NEXTSMS_WEBHOOK_TOKEN is not configured');
      return NextResponse.json({ error: 'Webhook token not configured' }, { status: 503 });
    }

    if (body.token !== WEBHOOK_VERIFY_TOKEN) {
      console.error('[Webhook] ❌ Invalid token');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const messageId = body.messageId != null ? String(body.messageId) : undefined;

    if (body.status) {
      return handleDeliveryCallback(body, messageId);
    }

    if (body.payload || body.response || body.text) {
      return handleButtonReply(body, messageId);
    }

    console.error('[Webhook] ❌ Missing callback fields');
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[Webhook] ❌ Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Webhook error',
        received: false,
      },
      { status: 500 }
    );
  }
}

async function handleDeliveryCallback(body: WhatsAppCallback, messageId?: string) {
  const { status } = body;

  if (!messageId || !status) {
    console.error('[Webhook] ❌ Missing messageId or status');
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  console.log(`[Webhook] Message ${messageId} status: ${status}`);

  try {
    const updatedLog = await prisma.messageLog.updateMany({
      where: { messageId },
      data: {
        status,
        deliveredAt: status === 'DELIVERED' ? new Date() : null,
        error:
          status === 'FAILED' || status === 'REJECTED'
            ? body.error || 'Delivery failed'
            : null,
        rawData: body as Prisma.InputJsonValue,
      },
    });

    if (updatedLog.count === 0) {
      console.warn(`[Webhook] ⚠️ No MessageLog found for messageId: ${messageId}`);
    }

    await prisma.deliveryLog.create({
      data: {
        messageId,
        status,
        rawData: body as Prisma.InputJsonValue,
      },
    });

    console.log(`[Webhook] ✅ Logged delivery status for message ${messageId}`);
  } catch (dbError) {
    console.error('[Webhook] ❌ Database error:', dbError);
  }

  switch (status) {
    case 'DELIVERED':
      console.log(`[Webhook] ✅ Message ${messageId} delivered successfully!`);
      await updateGuestOnDelivery(messageId);
      break;

    case 'FAILED':
      console.error(`[Webhook] ❌ Message ${messageId} failed!`);
      await markGuestDeliveryFailed(messageId, body.error || 'Delivery failed');
      break;

    case 'PENDING':
      console.log(`[Webhook] ⏳ Message ${messageId} is pending...`);
      break;

    case 'REJECTED':
      console.error(`[Webhook] ❌ Message ${messageId} was rejected by Meta!`);
      console.error('[Webhook] ⚠️ Check if template is approved');
      if (body.error) {
        console.error('[Webhook] Rejection reason:', body.error);
      }
      await markGuestDeliveryFailed(messageId, body.error || 'Rejected by provider');
      break;

    case 'SENT':
      console.log(`[Webhook] 📤 Message ${messageId} was sent to Meta`);
      break;

    default:
      console.log(`[Webhook] ℹ️ Unknown status: ${status}`);
  }

  return NextResponse.json({
    success: true,
    received: true,
    timestamp: new Date().toISOString(),
  });
}

async function handleButtonReply(body: WhatsAppCallback, messageId?: string) {
  const payload = typeof body.payload === 'string' ? body.payload : undefined;
  const label = String(body.response ?? body.text ?? '');
  const verified = payload ? verifyRsvpPayload(payload) : null;
  const action = verified?.action ?? actionFromButtonLabel(label);

  const messageLog = messageId
    ? await prisma.messageLog.findUnique({
        where: { messageId },
        select: { guestId: true, type: true, template: true },
      })
    : null;

  const guestId = verified?.guestId ?? messageLog?.guestId ?? null;

  if (!messageId || !guestId || !action) {
    console.warn('[Webhook] ⚠️ Button reply could not be matched', {
      messageId,
      guestId,
      action,
      label,
    });
    return NextResponse.json({ success: true, received: true });
  }

  if (messageLog?.guestId && messageLog.guestId !== guestId) {
    console.error('[Webhook] ❌ Button reply guest does not match the sent message', {
      messageId,
      payloadGuestId: guestId,
      loggedGuestId: messageLog.guestId,
    });
    return NextResponse.json({ success: true, received: true });
  }

  if (messageLog && messageLog.type !== 'WHATSAPP') {
    console.error('[Webhook] ❌ Button reply message is not a WhatsApp message', {
      messageId,
      type: messageLog.type,
    });
    return NextResponse.json({ success: true, received: true });
  }

  if (!verified && messageLog?.template !== 'SandOffTemp') {
    console.error('[Webhook] ❌ Unsigned button reply is not from an RSVP template', {
      messageId,
      template: messageLog?.template,
    });
    return NextResponse.json({ success: true, received: true });
  }

  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { id: true, name: true, eventId: true },
  });

  if (!guest) {
    console.error('[Webhook] ❌ Guest not found for button reply', { guestId });
    return NextResponse.json({ success: true, received: true });
  }

  const status = RSVP_STATUS_BY_ACTION[action];

  const duplicate = await prisma.rsvp.findFirst({
    where: { guestId, messageId, status },
    select: { id: true },
  });

  if (duplicate) {
    console.log('[Webhook] ℹ️ Duplicate button reply ignored', {
      guestId,
      messageId,
      status,
    });
    return NextResponse.json({ success: true, received: true });
  }

  await prisma.$transaction([
    prisma.guest.update({
      where: { id: guest.id },
      data: { attending: status },
    }),
    prisma.rsvp.updateMany({
      where: { eventId: guest.eventId, guestId: guest.id, isCurrent: true },
      data: { isCurrent: false },
    }),
    prisma.rsvp.create({
      data: {
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.name,
        status,
        channel: 'WHATSAPP',
        messageId,
        rawPayload: body as Prisma.InputJsonValue,
        isCurrent: true,
      },
    }),
  ]);

  revalidatePath('/client/dashboard');
  revalidatePath(`/client/events/${guest.eventId}`);
  revalidatePath(`/client/events/${guest.eventId}/rsvps`);

  console.log('[Webhook] ✅ RSVP updated from WhatsApp button reply', {
    guestId,
    guestName: guest.name,
    status,
    action,
    messageId,
  });

  return NextResponse.json({
    success: true,
    received: true,
    status,
    action,
  });
}

async function updateGuestOnDelivery(messageId: string) {
  try {
    const messageLog = await prisma.messageLog.findUnique({
      where: { messageId },
      select: { guestId: true, type: true },
    });

    if (!messageLog || !messageLog.guestId) {
      console.log(`[Webhook] ℹ️ No guest found for message ${messageId}`);
      return;
    }

    if (messageLog.type === 'WHATSAPP' || messageLog.type === 'SMS') {
      await prisma.guest.update({
        where: { id: messageLog.guestId },
        data: {
          invitationDeliveredAt: new Date(),
        },
      });
      console.log(`[Webhook] ✅ Updated guest ${messageLog.guestId} delivery status`);
    }
  } catch (error) {
    console.error('[Webhook] ❌ Error updating guest:', error);
  }
}

async function markGuestDeliveryFailed(messageId: string, error?: string) {
  try {
    const messageLog = await prisma.messageLog.findUnique({
      where: { messageId },
      select: { guestId: true, type: true },
    });

    if (!messageLog || !messageLog.guestId) {
      console.log(`[Webhook] ℹ️ No guest found for failed message ${messageId}`);
      return;
    }

    if (messageLog.type === 'WHATSAPP') {
      await prisma.guest.update({
        where: { id: messageLog.guestId },
        data: {
          onWhatsApp: false,
          routingChannel: 'sms',
        },
      });
      console.log(
        `[Webhook] 🚫 Guest ${messageLog.guestId} did not receive the message (${error}). Moved to SMS.`
      );
    }
  } catch (e) {
    console.error('[Webhook] ❌ Error marking guest delivery failed:', e);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Verification failed', { status: 403 });
}
