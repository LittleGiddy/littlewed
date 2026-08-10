import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isWhatsAppNumber } from '@/lib/validate-whatsapp';
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

    const result = await isWhatsAppNumber(normalized);

    return NextResponse.json({
      number: normalized,
      hasWhatsApp: result.hasWhatsApp,
      waId: result.waId,
      status: result.status,
      error: result.error,
    });
  } catch (error: any) {
    console.error('WhatsApp check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check WhatsApp' },
      { status: 500 }
    );
  }
}