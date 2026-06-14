import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateCheckoutLink } from '@/lib/clickpesa';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
  }

  const { amount } = await req.json();
  if (!amount || amount < 1000) {
    return NextResponse.json({ error: 'Minimum purchase amount is 1,000 TZS' }, { status: 400 });
  }

  // Create a pending transaction
  const transaction = await prisma.transaction.create({
    data: {
      amount,
      type: 'CREDIT_PURCHASE',
      status: 'PENDING',
      tenantId,
    },
  });

  // Generate a clean alphanumeric order reference
  const random = Math.random().toString(36).substring(2, 8);
  const orderReference = `credit${tenantId}${Date.now()}${random}`.replace(/[^a-zA-Z0-9]/g, '');

  // Store the order reference in the transaction (field accepts string | null)
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { stripeSessionId: orderReference }, // ✅ orderReference is a string, assignable to string | null
  });

  // Safely get customer info with fallbacks
  const customerName = (session.user as any).name || 'Customer';
  const customerEmail = session.user.email || '';

  let checkoutUrl: string;
  try {
    const result = await generateCheckoutLink({
      amount,
      orderReference,
      customerName,
      customerEmail,
      description: `Add ${amount} TZS credits`,
    });
    checkoutUrl = result.checkoutUrl;
  } catch (error) {
    console.error('ClickPesa error:', error);
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 });
  }

  return NextResponse.json({ checkoutUrl });
}