// app/api/whatsapp/test/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { testWhatsAppConnection } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phoneNumber } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required (e.g., 255712345678)' },
        { status: 400 }
      );
    }

    // Validate phone number format
    const cleanNumber = phoneNumber.replace(/^\+/, '');
    if (!/^[0-9]{10,15}$/.test(cleanNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use international format without +' },
        { status: 400 }
      );
    }

    const result = await testWhatsAppConnection(cleanNumber);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'WhatsApp message sent successfully!',
        data: result.data,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Test endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send test message' },
      { status: 500 }
    );
  }
}