// app/api/webhooks/whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || process.env.NEXTSMS_WEBHOOK_TOKEN;

// ─── GET: Webhook verification ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('[Webhook] Verification request:', { mode, token, challenge });

  if (!WEBHOOK_TOKEN) {
    console.error('[Webhook] ❌ WEBHOOK_TOKEN / NEXTSMS_WEBHOOK_TOKEN is not configured');
    return new NextResponse('Webhook token not configured', { status: 503 });
  }

  if (mode === 'subscribe' && token === WEBHOOK_TOKEN) {
    console.log('[Webhook] ✅ Webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  console.error('[Webhook] ❌ Webhook verification failed');
  return new NextResponse('Verification failed', { status: 403 });
}

// ─── POST: Handle delivery status updates ──────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[Webhook] ====== Received WhatsApp delivery callback ======');
    console.log('[Webhook] Payload:', JSON.stringify(body, null, 2));

    // ─── Verify webhook token ──────────────────────────────────────────
    if (!WEBHOOK_TOKEN) {
      console.error('[Webhook] ❌ WEBHOOK_TOKEN / NEXTSMS_WEBHOOK_TOKEN is not configured');
      return NextResponse.json(
        { error: 'Webhook token not configured. Set WEBHOOK_TOKEN (or NEXTSMS_WEBHOOK_TOKEN).' },
        { status: 503 }
      );
    }
    const token = body.token;
    if (token !== WEBHOOK_TOKEN) {
      console.error('[Webhook] ❌ Invalid webhook token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageId, status, id, error } = body;

    if (!messageId) {
      console.warn('[Webhook] ⚠️ No messageId in payload');
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    // ─── Map NexSMS status to our status ──────────────────────────────
    const statusMap: Record<string, string> = {
      'SENT': 'SENT',
      'DELIVERED': 'DELIVERED',
      'READ': 'READ',
      'FAILED': 'FAILED',
      'PENDING': 'SENT',
    };

    const ourStatus = statusMap[status] || status;

    // ─── Find and update the message log ──────────────────────────────
    let messageLog = await prisma.messageLog.findUnique({
      where: { messageId },
    });

    if (!messageLog) {
      console.warn(`[Webhook] ⚠️ No MessageLog found for messageId: ${messageId}`);
      
      // Try to find by messageId in rawData
      messageLog = await prisma.messageLog.findFirst({
        where: {
          rawData: {
            path: ['messageId'],
            equals: messageId,
          },
        },
      });

      if (!messageLog) {
        console.warn(`[Webhook] ⚠️ Could not find MessageLog for messageId: ${messageId}`);
        // Return 200 to avoid retries
        return NextResponse.json({ 
          success: true, 
          message: 'Webhook received but no matching log found',
          messageId 
        });
      }
    }

    // ─── Update the message log ────────────────────────────────────────
    const updateData: any = {
      status: ourStatus,
    };

    if (ourStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    } else if (ourStatus === 'FAILED') {
      updateData.error = error || body.error || body.reason || 'Delivery failed';
    }

    await prisma.messageLog.update({
      where: { id: messageLog.id },
      data: updateData,
    });

    console.log(`[Webhook] ✅ Updated MessageLog ${messageId} status to: ${ourStatus}`);

    // ─── If FAILED, log it prominently ──────────────────────────────────
    if (ourStatus === 'FAILED') {
      console.error(`[Webhook] ❌ Message ${messageId} failed!`);
      console.error(`[Webhook] Error: ${updateData.error || 'Unknown error'}`);

      // Mark guest as not received + fall back to SMS so the client can see
      // which numbers didn't get the message and retry by SMS.
      await markGuestDeliveryFailed(messageLog.guestId);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      messageId,
      status: ourStatus,
    });

  } catch (error: any) {
    console.error('[Webhook] ❌ Error processing webhook:', error.message);
    // Always return 200 to prevent NexSMS from retrying
    return NextResponse.json({ 
      success: false, 
      error: error.message,
    }, { status: 200 });
  }
}

// ─── Helper: Mark guest as not received ──────────────────────────────────
async function markGuestDeliveryFailed(guestId?: string | null) {
  if (!guestId) return;
  try {
    await prisma.guest.update({
      where: { id: guestId },
      data: { onWhatsApp: false, routingChannel: 'sms' },
    });
    console.log(`[Webhook] 🚫 Guest ${guestId} did not receive the message. Moved to SMS.`);
  } catch (e) {
    console.error('[Webhook] ❌ Error marking guest delivery failed:', e);
  }
}