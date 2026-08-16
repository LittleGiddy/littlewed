// app/api/check-in/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token, cardNumber } = await req.json();

    let guest = null;

    // ─── Find by QR token (contains card number) ────────────────────────
    if (token) {
      const scannedCardNumber = token.trim();
      if (scannedCardNumber) {
        guest = await prisma.guest.findFirst({
          where: { cardNumber: scannedCardNumber },
        });
      }
    }
    
    // ─── Find by manual card number entry ──────────────────────────────
    if (!guest && cardNumber) {
      const cleanCardNumber = cardNumber.trim().padStart(5, '0');
      if (cleanCardNumber) {
        guest = await prisma.guest.findFirst({
          where: { cardNumber: cleanCardNumber },
        });
      }
    }

    if (!guest) {
      return NextResponse.json(
        { error: 'Guest not found. Please check the card number.' },
        { status: 404 }
      );
    }

    // ─── Determine max check-ins based on guest type ────────────────────
    const maxCheckIns = guest.guestType?.toUpperCase() === 'DOUBLE' ? 2 : 1;
    const currentCount = guest.checkInCount || 0;

    // ─── Check if already checked in maximum times ──────────────────────
    if (currentCount >= maxCheckIns) {
      return NextResponse.json(
        { 
          error: `Guest already checked in ${currentCount} time${currentCount > 1 ? 's' : ''}. Maximum: ${maxCheckIns}`,
          checkedIn: true,
          checkInCount: currentCount,
          maxCheckIns: maxCheckIns,
        },
        { status: 400 }
      );
    }

    // ─── Mark as checked in ──────────────────────────────────────────────
    const newCount = currentCount + 1;
    const isFullyCheckedIn = newCount >= maxCheckIns;

    const updated = await prisma.guest.update({
      where: { id: guest.id },
      data: { 
        checkInCount: newCount,
        checkedIn: isFullyCheckedIn,
        checkedInAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      guest: {
        id: updated.id,
        name: updated.name,
        cardNumber: updated.cardNumber,
        guestType: updated.guestType || 'SINGLE',
        checkInCount: newCount,
        maxCheckIns: maxCheckIns,
        fullyCheckedIn: isFullyCheckedIn,
        checkedInAt: updated.checkedInAt,
      },
      message: isFullyCheckedIn 
        ? `${guest.name} fully checked in (${newCount}/${maxCheckIns})`
        : `${guest.name} checked in (${newCount}/${maxCheckIns}) - ${maxCheckIns - newCount} more allowed`,
    });
  } catch (error: any) {
    console.error('Check‑in error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── GET: Get all guests for an event ──────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    const guests = await prisma.guest.findMany({
      where: { eventId },
      select: {
        id: true,
        name: true,
        title: true,
        cardNumber: true,
        guestType: true,
        checkInCount: true,
        checkedIn: true,
        checkedInAt: true,
        phone: true,
        routingChannel: true,
        createdAt: true,
      },
      orderBy: { cardNumber: 'asc' },
    });

    return NextResponse.json(guests);
  } catch (error: any) {
    console.error('Error fetching guests:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch guests' },
      { status: 500 }
    );
  }
}