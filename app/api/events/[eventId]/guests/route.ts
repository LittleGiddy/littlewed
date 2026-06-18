import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  console.log('API called for eventId:', eventId);

  try {
    const guests = await prisma.guest.findMany({
      where: { eventId },
      select: {
        id: true,
        name: true,
        phone: true,
        invitationCard: true,
        checkedIn: true,        // ✅ Add this field
        routingChannel: true,   // ✅ Add for completeness (used in UI)
        attending: true,        // ✅ Add for completeness
      },
      orderBy: { name: 'asc' },
    });
    console.log('Found guests:', guests.length);

    // ✅ Prevent caching so the staff dashboard always gets fresh data
    return NextResponse.json(guests, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching guests:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}