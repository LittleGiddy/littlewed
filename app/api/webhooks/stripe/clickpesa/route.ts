import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CREDIT_COST = 300; // TZS per credit (same as per guest commission)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('ClickPesa webhook payload:', JSON.stringify(body, null, 2));

    // ──────────────────────────────────────────────────────────────
    // 1. Extract payment details (adjust to your ClickPesa payload)
    // ──────────────────────────────────────────────────────────────
    const {
      orderReference,      // e.g., "event_<pendingId>" or "credit_purchase_<transactionId>"
      status,              // "COMPLETED", "SUCCESS", "FAILED", etc.
      amount,              // total amount paid in TZS
      // other fields as needed
    } = body;

    // Only process successful payments
    if (status !== 'COMPLETED' && status !== 'SUCCESS') {
      // If payment failed, we could mark the transaction as FAILED, but we'll just ignore.
      console.log(`Payment not successful: ${status}`);
      return NextResponse.json({ received: true });
    }

    // ──────────────────────────────────────────────────────────────
    // 2. Determine the type of payment from the orderReference
    // ──────────────────────────────────────────────────────────────
    let pendingEventId: string | null = null;
    let transactionId: string | null = null;

    if (orderReference.startsWith('event_')) {
      pendingEventId = orderReference.replace('event_', '');
    } else if (orderReference.startsWith('credit_purchase_')) {
      transactionId = orderReference.replace('credit_purchase_', '');
    } else {
      console.warn(`Unknown orderReference format: ${orderReference}`);
      return NextResponse.json({ received: true });
    }

    // ──────────────────────────────────────────────────────────────
    // 3. Handle event commission payment
    // ──────────────────────────────────────────────────────────────
    if (pendingEventId) {
      const pendingEvent = await prisma.pendingEvent.findUnique({
        where: { id: pendingEventId },
        include: { tenant: true },
      });

      if (!pendingEvent) {
        console.warn(`Pending event not found: ${pendingEventId}`);
        return NextResponse.json({ received: true });
      }

      // Create the actual event and mark commission as paid
      await prisma.$transaction([
        prisma.event.create({
          data: {
            name: pendingEvent.name,
            date: pendingEvent.date,
            venue: pendingEvent.venue,
            address: pendingEvent.address,
            guestCount: pendingEvent.guestCount || 0,
            total_budget: pendingEvent.total_budget,
            commission_paid: true,
            tenantId: pendingEvent.tenantId,
          },
        }),
        prisma.pendingEvent.delete({ where: { id: pendingEventId } }),
        // Optional: create a transaction record for the payment
        prisma.transaction.create({
          data: {
            tenantId: pendingEvent.tenantId,
            eventId: pendingEvent.id,
            amount: pendingEvent.commission,
            type: 'COMMISSION_PAYMENT',
            status: 'COMPLETED',
            stripeSessionId: orderReference, // store reference
          },
        }),
      ]);

      console.log(`✅ Event created from pendingEvent ${pendingEventId}`);
      return NextResponse.json({ received: true });
    }

    // ──────────────────────────────────────────────────────────────
    // 4. Handle credit purchase payment
    // ──────────────────────────────────────────────────────────────
    if (transactionId) {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        console.warn(`Transaction not found: ${transactionId}`);
        return NextResponse.json({ received: true });
      }

      if (transaction.status === 'COMPLETED') {
        console.log(`Transaction ${transactionId} already completed.`);
        return NextResponse.json({ received: true });
      }

      // Calculate credits: amount / 300 (each credit = 300 TZS)
      const creditsToAdd = Math.floor(transaction.amount / CREDIT_COST);

      if (creditsToAdd <= 0) {
        console.warn(`Amount too low for credits: ${transaction.amount} TZS`);
        return NextResponse.json({ received: true });
      }

      // Update tenant credits and mark transaction as completed
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: transactionId },
          data: { status: 'COMPLETED' },
        }),
        prisma.tenant.update({
          where: { id: transaction.tenantId },
          data: { credits: { increment: creditsToAdd } },
        }),
      ]);

      console.log(`✅ Added ${creditsToAdd} credits to tenant ${transaction.tenantId}`);
      return NextResponse.json({ received: true });
    }

    // If we get here, the orderReference was not recognised
    console.warn(`Unhandled orderReference: ${orderReference}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}