import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // ✅ import authOptions
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getServerSession(authOptions); // ✅ add authOptions
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role; // ✅ type cast
    const tenantId = (session.user as any).tenantId; // ✅ get tenantId

    // ✅ verify user has permission
    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { eventId } = await params;

    // ✅ verify event belongs to tenant (not userId)
    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Delete all guests for this event
    await prisma.guest.deleteMany({
      where: { eventId },
    });

    return NextResponse.json({
      success: true,
      message: 'All guests deleted',
    });
  } catch (error: any) {
    console.error('DELETE /api/guests/delete-all/[eventId] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}