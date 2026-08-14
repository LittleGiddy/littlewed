// app/api/whatsapp/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';

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

    // Since NexSMS doesn't have a direct check endpoint,
    // we assume WhatsApp is available and let the send API handle errors
    return NextResponse.json({
      number: normalized,
      hasWhatsApp: true,
      waId: normalized.replace(/\D/g, ''),
    });
  } catch (error: any) {
    console.error('WhatsApp check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check WhatsApp' },
      { status: 500 }
    );
  }
}