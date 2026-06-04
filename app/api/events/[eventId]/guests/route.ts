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
      select: { id: true, name: true, phone: true, invitationCard: true },
    });
    console.log('Found guests:', guests.length);
    return NextResponse.json(guests);
  } catch (error) {
    console.error('Error fetching guests:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}