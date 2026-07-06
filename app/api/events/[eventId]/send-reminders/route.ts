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

  // Fetch event and tenant credits
  const event = await prisma.event.findUnique({
    where: { id: eventId, tenantId },
    include: { tenant: { select: { credits: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Fetch selected guests, only those with a phone number
  const guests = await prisma.guest.findMany({
    where: {
      id: { in: guestIds },
      eventId: eventId,
      phone: { not: null }, // only guests with a phone number
    },
    select: {
      id: true,
      name: true,
      phone: true,
      reminderCount: true,
    },
  });

  if (guests.length === 0) {
    return NextResponse.json({ error: 'No valid guests with phone numbers selected' }, { status: 400 });
  }

  // Calculate cost: first reminder free, subsequent 50 TZS each
  let totalCost = 0;
  for (const guest of guests) {
    totalCost += guest.reminderCount === 0 ? 0 : 50;
  }

  // Check credits
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

  // Send SMS to each guest
  const results = [];
  for (const guest of guests) {
    try {
      // Ensure phone is a string (not null) – we filtered so it's safe
      const phone = guest.phone as string;
      const personalized = message
        .replace(/{name}/g, guest.name)
        .replace(/{event}/g, event.name);

      await sendSms(phone, personalized);

      await prisma.guest.update({
        where: { id: guest.id },
        data: { reminderCount: { increment: 1 } },
      });

      results.push({ guestId: guest.id, success: true });
    } catch (error) {
      console.error(`Failed to send SMS to ${guest.phone}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({ guestId: guest.id, success: false, error: errorMessage });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return NextResponse.json({
    success: true,
    successCount,
    totalCost,
    remainingCredits: event.tenant.credits - totalCost,
    details: results,
  });
}