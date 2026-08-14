// app/api/webhooks/whatsapp-delivery/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ─── Configuration ──────────────────────────────────────────────────────
// This token should match the one in your NexSMS dashboard
const WEBHOOK_VERIFY_TOKEN = process.env.NEXTSMS_WEBHOOK_TOKEN || 'your-verify-token-here';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log('[Webhook] ====== Received WhatsApp delivery callback ======');
    console.log('[Webhook] Payload:', JSON.stringify(body, null, 2));

    // ─── Verify the token ──────────────────────────────────────────────
    if (body.token !== WEBHOOK_VERIFY_TOKEN) {
      console.error('[Webhook] ❌ Invalid token:', body.token);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { messageId, status, id } = body;

    if (!messageId || !status) {
      console.error('[Webhook] ❌ Missing messageId or status');
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    console.log(`[Webhook] Message ${messageId} status: ${status}`);

    // ─── Log the delivery status to your database ──────────────────────
    try {
      // ─── 1. Update the MessageLog table ──────────────────────────────
      const updatedLog = await prisma.messageLog.updateMany({
        where: { messageId: messageId },
        data: {
          status: status,
          deliveredAt: status === 'DELIVERED' ? new Date() : null,
          error: status === 'FAILED' || status === 'REJECTED' 
            ? body.error || 'Delivery failed' 
            : null,
          rawData: body, // Store the full webhook payload
        },
      });

      if (updatedLog.count === 0) {
        // ─── 2. If no MessageLog found, try to find by guest ────────────
        console.warn(`[Webhook] ⚠️ No MessageLog found for messageId: ${messageId}`);
        
        // Try to find the guest by waId or phone
        // This is useful if you didn't store the messageId during send
        // You can implement guest lookup logic here if needed
      }

      // ─── 3. Log to separate delivery log table ──────────────────────
      await prisma.deliveryLog.create({
        data: {
          messageId: messageId,
          status: status,
          rawData: body,
        },
      });

      console.log(`[Webhook] ✅ Logged delivery status for message ${messageId}`);

    } catch (dbError) {
      console.error('[Webhook] ❌ Database error:', dbError);
      // Don't fail the webhook - log and continue
    }

    // ─── Handle specific statuses ──────────────────────────────────────
    switch (status) {
      case 'DELIVERED':
        console.log(`[Webhook] ✅ Message ${messageId} delivered successfully!`);
        // Update guest invitation status if this is an invitation
        await updateGuestOnDelivery(messageId);
        break;

      case 'FAILED':
        console.error(`[Webhook] ❌ Message ${messageId} failed!`);
        // You could send an alert or retry here
        break;

      case 'PENDING':
        console.log(`[Webhook] ⏳ Message ${messageId} is pending...`);
        break;

      case 'REJECTED':
        console.error(`[Webhook] ❌ Message ${messageId} was rejected by Meta!`);
        console.error('[Webhook] ⚠️ Check if template is approved');
        // Log the rejection reason if available
        if (body.error) {
          console.error('[Webhook] Rejection reason:', body.error);
        }
        break;

      case 'SENT':
        console.log(`[Webhook] 📤 Message ${messageId} was sent to Meta`);
        break;

      default:
        console.log(`[Webhook] ℹ️ Unknown status: ${status}`);
    }

    // ─── Always return 200 to acknowledge receipt ──────────────────────
    return NextResponse.json({ 
      success: true,
      received: true,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error('[Webhook] ❌ Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Webhook error',
        received: false,
      },
      { status: 500 }
    );
  }
}

// ─── Helper: Update guest when message is delivered ────────────────────
async function updateGuestOnDelivery(messageId: string) {
  try {
    // Find the message log to get the guest ID
    const messageLog = await prisma.messageLog.findUnique({
      where: { messageId: messageId },
      select: { guestId: true, type: true },
    });

    if (!messageLog || !messageLog.guestId) {
      console.log(`[Webhook] ℹ️ No guest found for message ${messageId}`);
      return;
    }

    // Update the guest's invitation status
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

// ─── Optional: GET endpoint for webhook verification ──────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // For Meta/WhatsApp webhook verification (if needed)
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Verification failed', { status: 403 });
}