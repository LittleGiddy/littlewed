import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSms } from '@/lib/sms';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  const { eventId } = await params;
  const { guestIds, message } = await req.json();

  if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
    return NextResponse.json({ error: 'No guests selected' }, { status: 400 });
  }
  if (!message || message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, tenantId },
    include: { tenant: { select: { credits: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const guests = await prisma.guest.findMany({
    where: {
      id: { in: guestIds },
      eventId,
      phone: { not: null },
    },
    select: { id: true, name: true, phone: true, reminderCount: true },
  });

  if (guests.length === 0) {
    return NextResponse.json({ error: 'No valid guests with phone numbers' }, { status: 400 });
  }

  // Calculate cost
  let totalCost = 0;
  for (const g of guests) {
    totalCost += g.reminderCount === 0 ? 0 : 50;
  }

  if (totalCost > 0 && (event.tenant.credits ?? 0) < totalCost) {
    return NextResponse.json({
      error: `Insufficient credits. Need ${totalCost} TZS, you have ${event.tenant.credits} TZS.`,
    }, { status: 400 });
  }

  // Deduct credits
  if (totalCost > 0) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { credits: { decrement: totalCost } },
    });
  }

  const results = [];
  for (const guest of guests) {
    try {
      const phone = guest.phone as string;
      const personalized = message
        .replace(/{name}/g, guest.name)
        .replace(/{event}/g, event.name);

      const smsResult = await sendSms(phone, personalized);

      // Determine if SMS was actually sent successfully
      let success = false;
      let errorMsg = null;
      if (smsResult.success && smsResult.result?.SMSMessageData?.Recipients) {
        const recipients = smsResult.result.SMSMessageData.Recipients;
        // Check all recipients – for a single recipient we expect one item
        const allOk = recipients.every((r: any) => r.status === 'Success');
        if (allOk) {
          success = true;
        } else {
          const failed = recipients.filter((r: any) => r.status !== 'Success');
          errorMsg = failed.map((r: any) => `Status ${r.status}`).join(', ');
        }
      } else {
        errorMsg = smsResult.error || 'SMS sending failed';
      }

      if (success) {
        await prisma.guest.update({
          where: { id: guest.id },
          data: { reminderCount: { increment: 1 } },
        });
        results.push({ guestId: guest.id, success: true });
      } else {
        results.push({ guestId: guest.id, success: false, error: errorMsg });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ guestId: guest.id, success: false, error: msg });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const errors = results.filter(r => !r.success).map(r => ({ guestId: r.guestId, error: r.error }));

  return NextResponse.json({
    success: true,
    successCount,
    totalCost,
    remainingCredits: event.tenant.credits - totalCost,
    errors: errors.length > 0 ? errors : undefined,
    details: results,
  });
}