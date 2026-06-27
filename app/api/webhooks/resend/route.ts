import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma'; // ✅ correct root import

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Resend webhook payload:', JSON.stringify(body, null, 2));

    // Example: handle events
    const { type, data } = body;

    // You can process events like email.delivered, email.opened, etc.

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Resend webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}