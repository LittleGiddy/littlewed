import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma'; // ✅ correct root import
import { headers } from 'next/headers';

// ─── Types ──────────────────────────────────────────────────────────────

interface ResendWebhookEvent {
  type: string;
  data: {
    id?: string;
    email?: string;
    to?: string[];
    from?: string;
    subject?: string;
    html?: string;
    text?: string;
    attachment?: any[];
    delivered_at?: string;
    opened_at?: string;
    clicked_at?: string;
    [key: string]: any;
  };
}

interface IncomingEmail {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  attachment?: any[];
  messageId?: string;
  repliedTo?: string; // The original email ID this is a reply to
}

// ─── Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const signature = headersList.get('resend-signature');

    // ─── Verify webhook signature (optional but recommended) ───
    // const isValid = await verifyResendSignature(
    //   signature,
    //   await req.text(),
    //   process.env.RESEND_WEBHOOK_SECRET!
    // );
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    const body = await req.json();
    console.log('Resend webhook payload:', JSON.stringify(body, null, 2));

    const { type, data } = body as ResendWebhookEvent;

    // ─── Handle different event types ─────────────────────────────

    switch (type) {
      // ─── Incoming Email (when someone replies to your email) ───
      case 'email.received':
        await handleIncomingEmail(data);
        break;

      // ─── Email Delivery Events ──────────────────────────────────
      case 'email.delivered':
        await handleDeliveryEvent(data);
        break;

      case 'email.opened':
        await handleOpenEvent(data);
        break;

      case 'email.clicked':
        await handleClickEvent(data);
        break;

      case 'email.bounced':
        await handleBounceEvent(data);
        break;

      case 'email.complained':
        await handleComplaintEvent(data);
        break;

      default:
        console.log(`Unhandled webhook event type: ${type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Resend webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Event Handlers ─────────────────────────────────────────────────────

// 🚀 Handle Incoming Emails (replies, forwarded emails)
async function handleIncomingEmail(data: any) {
  console.log('📨 Incoming email received:', data);

  const email: IncomingEmail = {
    from: data.from,
    to: data.to || [],
    subject: data.subject || '',
    html: data.html || '',
    text: data.text || '',
    attachment: data.attachment || [],
    messageId: data.messageId || data.id,
    repliedTo: data.repliedTo || data.inReplyTo || null,
  };

  // ─── Store in database ──────────────────────────────────────────────
  try {
    // Option 1: Store in a custom "IncomingEmail" table
    // await prisma.incomingEmail.create({
    //   data: {
    //     from: email.from,
    //     to: email.to,
    //     subject: email.subject,
    //     html: email.html,
    //     text: email.text,
    //     messageId: email.messageId,
    //     repliedTo: email.repliedTo,
    //     receivedAt: new Date(),
    //   },
    // });

    // Option 2: Attach to the original guest/event record
    // Extract the original email ID from the subject or reply-to header
    // Example: "Re: Your invitation to Sarah & James Wedding (event-123)"
    // const eventId = extractEventIdFromSubject(email.subject);
    // if (eventId) {
    //   await prisma.guest.updateMany({
    //     where: { eventId, email: email.from },
    //     data: { replyReceivedAt: new Date(), replyContent: email.text },
    //   });
    // }

    console.log('✅ Incoming email processed:', email.subject);
  } catch (error) {
    console.error('Failed to store incoming email:', error);
  }
}

// ─── Delivery Event ─────────────────────────────────────────────────────
async function handleDeliveryEvent(data: any) {
  console.log('📬 Email delivered:', data.id);
  // Update your database to mark this email as delivered
  // await prisma.emailLog.update({
  //   where: { resendId: data.id },
  //   data: { deliveredAt: new Date() },
  // });
}

// ─── Open Event ─────────────────────────────────────────────────────────
async function handleOpenEvent(data: any) {
  console.log('👁️ Email opened:', data.id);
  // Update your database to mark this email as opened
  // await prisma.emailLog.update({
  //   where: { resendId: data.id },
  //   data: { openedAt: new Date(), openCount: { increment: 1 } },
  // });
}

// ─── Click Event ────────────────────────────────────────────────────────
async function handleClickEvent(data: any) {
  console.log('🖱️ Email clicked:', data.id);
  // await prisma.emailLog.update({
  //   where: { resendId: data.id },
  //   data: { clickedAt: new Date(), clickCount: { increment: 1 } },
  // });
}

// ─── Bounce Event ───────────────────────────────────────────────────────
async function handleBounceEvent(data: any) {
  console.log('💥 Email bounced:', data.id);
  // await prisma.emailLog.update({
  //   where: { resendId: data.id },
  //   data: { bouncedAt: new Date(), bounceReason: data.error },
  // });
}

// ─── Complaint Event ────────────────────────────────────────────────────
async function handleComplaintEvent(data: any) {
  console.log('🚫 Email complained:', data.id);
  // Mark the recipient as inactive or remove them
  // await prisma.guest.updateMany({
  //   where: { email: data.to?.[0] },
  //   data: { isActive: false, complaintAt: new Date() },
  // });
}

// ─── Optional: Webhook Signature Verification ─────────────────────────
// async function verifyResendSignature(
//   signature: string | null,
//   body: string,
//   secret: string
// ): Promise<boolean> {
//   if (!signature) return false;
//   const crypto = await import('crypto');
//   const hmac = crypto.createHmac('sha256', secret);
//   hmac.update(body);
//   const digest = hmac.digest('hex');
//   return crypto.timingSafeEqual(
//     Buffer.from(digest),
//     Buffer.from(signature)
//   );
// }