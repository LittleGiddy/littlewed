import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateCheckoutLink } from '@/lib/clickpesa'; // ✅ Use ClickPesa instead

const COMMISSION_PER_GUEST = 200; // TZS

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const tenantId = (session.user as any).tenantId;
  const { name, date, venue, address, guestCount } = await req.json();
  
  if (!name || !date || !venue || !address || !guestCount || guestCount < 1) {
    return NextResponse.json({ error: 'Invalid guest count (minimum 1)' }, { status: 400 });
  }

  const commission = guestCount * COMMISSION_PER_GUEST;

  // ✅ Create pending event
  const pending = await prisma.pendingEvent.create({
    data: {
      name,
      date: new Date(date),
      venue,
      address,
      total_budget: commission,
      commission,
      tenantId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  // ✅ Generate ClickPesa checkout link
  const random = Math.random().toString(36).substring(2, 8);
  const orderReference = `event${pending.id}${random}`.replace(/[^a-zA-Z0-9]/g, '');

  const customerName = (session.user as any).name || 'Customer';
  const customerEmail = session.user.email || '';

  let checkoutUrl: string;
  try {
    const result = await generateCheckoutLink({
      amount: commission,
      orderReference,
      customerName,
      customerEmail,
      description: `Event commission for "${name}" (${guestCount} guests)`,
    });
    checkoutUrl = result.checkoutUrl;
  } catch (error) {
    console.error('ClickPesa error:', error);
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 });
  }

  return NextResponse.json({ checkoutUrl });
}