// app/api/whatsapp/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';

const NEXTSMS_TOKEN = process.env.NEXTSMS_TOKEN;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const { normalized, isValid } = normalizePhone(phone);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    // ─── Since NexSMS doesn't have a direct check endpoint ────────────
    // We'll assume WhatsApp is available and let the send API handle errors
    // This is the simplest approach without making extra API calls

    // Option 1: Always return true (recommended - let send API handle errors)
    return NextResponse.json({
      number: normalized,
      hasWhatsApp: true,
      waId: normalized.replace(/\D/g, ''),
      status: 'assumed',
    });

    // Option 2: If NexSMS has a number context API, use it:
    // try {
    //   const cleanPhone = normalized.replace(/^\+/, '').replace(/\D/g, '');
    //   const response = await fetch('https://messaging-service.co.tz/api/whatsapp/v2/number/context', {
    //     method: 'POST',
    //     headers: {
    //       'Authorization': `Bearer ${NEXTSMS_TOKEN}`,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({ to: [cleanPhone] }),
    //   });
    //   const data = await response.json();
    //   return NextResponse.json({
    //     number: normalized,
    //     hasWhatsApp: data.status === 'valid',
    //     waId: data.waId,
    //     status: data.status,
    //   });
    // } catch (error: any) {
    //   return NextResponse.json({
    //     number: normalized,
    //     hasWhatsApp: false,
    //     error: error.message,
    //   });
    // }
  } catch (error: any) {
    console.error('WhatsApp check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check WhatsApp' },
      { status: 500 }
    );
  }
}