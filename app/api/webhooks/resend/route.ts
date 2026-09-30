// app/api/webhooks/resend/route.ts
// Receives Resend's outbound delivery events and inbound replies.
//
// Signature verification is mandatory here: without it anyone who learns this
// URL can post forged `email.bounced` events and have guests flagged as
// undeliverable. The secret is RESEND_WEBHOOK_SECRET (the "Signing Secret"
// shown in Resend's dashboard, not the API key).
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────────

interface ResendWebhookEvent {
  type: string;
  created_at?: string;
  data: {
    id?: string;
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    html?: string;
    text?: string;
    message_id?: string;
    in_reply_to?: string;
    attachment?: unknown[];
    timestamp?: string;
    error?: string;
    reason?: string;
    [key: string]: unknown;
  };
}

// ─── Signature verification ─────────────────────────────────────────────

/**
 * Resend signs the raw request body with HMAC-SHA256 and sends the digest in
 * the `resend-signature` header as one or more `v1,<digest>` space/comma
 * separated parts. Older integrations use hex, newer ones base64, so both are
 * computed and compared.
 */
function verifyResendSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) return false;

  const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedB64 = createHmac('sha256', secret).update(rawBody).digest('base64');

  // Header shape: "v1,<hex>" possibly with extra parts for key rotation.
  const parts = signatureHeader
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const candidates: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    // Accept both "v1,<digest>" and a bare digest (no version prefix).
    if (/^v\d+$/.test(parts[i]) && i + 1 < parts.length) candidates.push(parts[i + 1]);
    else if (!/^v\d+$/.test(parts[i])) candidates.push(parts[i]);
  }

  return candidates.some((candidate) => {
    const received = Buffer.from(candidate);
    for (const expected of [expectedHex, expectedB64]) {
      const expectedBuf = Buffer.from(expected);
      // timingSafeEqual throws on length mismatch, so guard first.
      if (received.length === expectedBuf.length && timingSafeEqual(received, expectedBuf)) {
        return true;
      }
    }
    return false;
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────

function eventTime(data: ResendWebhookEvent['data']): Date {
  if (typeof data.timestamp === 'string') {
    const d = new Date(data.timestamp);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function errorText(data: ResendWebhookEvent['data']): string | null {
  const err = data.error;
  if (typeof err === 'string') return err.slice(0, 500);
  if (err && typeof err === 'object') {
    try {
      return JSON.stringify(err).slice(0, 500);
    } catch {
      return null;
    }
  }
  if (typeof data.reason === 'string') return data.reason.slice(0, 500);
  return null;
}

/**
 * Append to the DeliveryLog ledger. Resend retries aggressively, so a plain
 * insert would double-count opens on every retry.
 */
async function logDelivery(
  messageId: string,
  status: string,
  payload: Record<string, unknown>,
  at: Date
): Promise<void> {
  const existing = await prisma.deliveryLog.findFirst({
    where: { messageId, status },
    select: { id: true },
  });
  if (existing) return;
  await prisma.deliveryLog.create({
    data: { messageId, status, rawData: payload as never, createdAt: at },
  });
}

// ─── Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Resend] RESEND_WEBHOOK_SECRET is not set. Rejecting webhook.');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  // Must read the raw body once: signing is computed over the exact bytes.
  const rawBody = await req.text();

  if (!verifyResendSignature(rawBody, req.headers.get('resend-signature'), secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: ResendWebhookEvent;
  try {
    body = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, data } = body;
  if (!type || !data || typeof data !== 'object') {
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }

  try {
    switch (type) {
      case 'email.received':
        await handleIncomingEmail(data);
        break;

      case 'email.delivered':
        await handleDeliveryEvent('DELIVERED', data);
        break;

      case 'email.opened':
        await handleDeliveryEvent('OPENED', data);
        break;

      case 'email.clicked':
        await handleDeliveryEvent('CLICKED', data);
        break;

      case 'email.bounced':
        await handleBounceEvent(data);
        break;

      case 'email.complained':
        await handleComplaintEvent(data);
        break;

      default:
        // Resend adds event types over time; acknowledging unknown ones keeps
        // it from retrying forever.
        return NextResponse.json({ received: true, ignored: type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Resend] handler failed:', error);
    // 500 tells Resend to retry, which is what we want for a transient DB error.
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Event handlers ─────────────────────────────────────────────────────

async function handleIncomingEmail(data: ResendWebhookEvent['data']) {
  const messageId = data.message_id || data.id || null;

  // Idempotency: Resend redelivers inbound mail on retry.
  if (messageId) {
    const seen = await prisma.incomingEmail.findFirst({
      where: { messageId },
      select: { id: true },
    });
    if (seen) {
      console.log(`[Resend] Incoming email ${messageId} already stored.`);
      return;
    }
  }

  // Try to attribute the reply to a guest. Tenant event invitations are sent
  // from the tenant's own address, so matching on the recipient address of the
  // inbound message is the reliable direction.
  const to = Array.isArray(data.to) ? data.to : [];
  const guest = to.length
    ? await prisma.guest.findFirst({
        where: { email: { equals: to[0], mode: 'insensitive' } },
        select: { id: true, eventId: true },
      })
    : null;

  await prisma.incomingEmail.create({
    data: {
      from: data.from || '',
      to,
      subject: data.subject || '',
      html: typeof data.html === 'string' ? data.html : null,
      text: typeof data.text === 'string' ? data.text : null,
      messageId,
      repliedTo: data.in_reply_to || null,
      eventId: guest?.eventId ?? null,
      guestId: guest?.id ?? null,
    },
  });

  // Surface the reply to the tenant who owns the event.
  if (guest) {
    const tenantUser = await prisma.user.findFirst({
      where: { tenantId: (await prisma.event.findUnique({
        where: { id: guest.eventId },
        select: { tenantId: true },
      }))?.tenantId },
      select: { id: true },
    });
    if (tenantUser) {
      await prisma.notification.create({
        data: {
          userId: tenantUser.id,
          title: 'New guest reply',
          message: data.subject || 'A guest replied to your invitation email.',
          type: 'info',
          link: `/client/events/${guest.eventId}/guests`,
        },
      });
    }
  }
}

async function handleDeliveryEvent(
  status: 'DELIVERED' | 'OPENED' | 'CLICKED',
  data: ResendWebhookEvent['data']
) {
  const messageId = data.email_id || data.id;
  if (!messageId) return;

  await logDelivery(
    messageId,
    status,
    {
      to: data.to ?? [],
      at: eventTime(data).toISOString(),
    },
    eventTime(data)
  );
}

/**
 * A hard bounce means the address is undeliverable. Record it and raise a
 * system log so a tenant/admin can see it rather than silently re-sending.
 */
async function handleBounceEvent(data: ResendWebhookEvent['data']) {
  const messageId = data.email_id || data.id;
  if (messageId) {
    await logDelivery(
      messageId,
      'BOUNCED',
      { to: data.to ?? [], error: errorText(data), at: eventTime(data).toISOString() },
      eventTime(data)
    );
  }

  const reason = errorText(data) ?? 'No reason supplied by Resend';
  const recipients = Array.isArray(data.to) ? data.to : [];
  console.warn(`[Resend] Email bounced (${recipients.join(', ') || 'unknown'}): ${reason}`);

  await prisma.systemLog.create({
    data: {
      type: 'email_bounce',
      level: 'WARN',
      message: `Email bounced for ${recipients.join(', ') || 'unknown recipient'}: ${reason}`,
      details: { messageId: messageId ?? null, to: recipients },
    },
  });
}

/** A spam complaint is worse than a bounce: the address must not be used again. */
async function handleComplaintEvent(data: ResendWebhookEvent['data']) {
  const messageId = data.email_id || data.id;
  if (messageId) {
    await logDelivery(
      messageId,
      'COMPLAINED',
      { to: data.to ?? [], at: eventTime(data).toISOString() },
      eventTime(data)
    );
  }

  const recipients = Array.isArray(data.to) ? data.to : [];
  await prisma.systemLog.create({
    data: {
      type: 'email_complaint',
      level: 'ERROR',
      message: `Recipient reported spam for ${recipients.join(', ') || 'unknown recipient'}`,
      details: { messageId: messageId ?? null, to: recipients },
    },
  });
}
