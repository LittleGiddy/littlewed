// app/api/guests/[id]/channel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { id } = await params;
    const { routingChannel } = await req.json();

    if (!routingChannel || !['sms', 'whatsapp'].includes(routingChannel)) {
      return NextResponse.json(
        { error: 'Invalid channel. Must be "sms" or "whatsapp"' },
        { status: 400 }
      );
    }

    const guest = await prisma.guest.findFirst({
      where: { id, event: { tenantId } },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    await prisma.guest.update({
      where: { id },
      data: { routingChannel },
    });

    return NextResponse.json({
      success: true,
      message: `Guest switched to ${routingChannel}`,
      routingChannel,
    });
  } catch (error: any) {
    console.error('Switch channel error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}