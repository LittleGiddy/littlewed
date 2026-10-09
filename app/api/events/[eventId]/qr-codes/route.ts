// app/api/events/[eventId]/qr-codes/route.ts
//
// Generates standalone QR "sticker" codes for an event's guests so the tenant
// can print them, cut them out, and fix them onto physical cards. Each sticker
// encodes exactly the guest's card number — the same value the invitation-card
// QR encodes (lib/image-storage) — so scanning a sticker with the staff scanner
// (POST /api/check-in) resolves the guest and marks the card VALID.
//
//   GET /api/events/:eventId/qr-codes                      → manifest (unique stickers)
//   GET /api/events/:eventId/qr-codes?sheet=1&page=N       → A4 PNG sheet (20/page)
//   GET /api/events/:eventId/qr-codes?guestId=...          → single QR PNG
//
// Guards match the other event APIs: tenants own their events, and staff may
// only touch events they were explicitly granted (canAccessEvent).
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessEvent } from '@/lib/eventAccess';
import {
  buildQrPrintSheet,
  generateQRFromCardNumber,
  QR_SHEET_PAGE_SIZE,
} from '@/lib/qr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHEET_QR_SIZE = 340;
const SINGLE_QR_SIZE = 400;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as { tenantId?: string }).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { eventId } = await params;
    if (!(await canAccessEvent(session, eventId))) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Guests with a card number. Shared cards (cardGroupId) reuse one number,
    // so the sheet shows a single sticker per unique card number.
    const guests = await prisma.guest.findMany({
      where: { eventId, cardNumber: { not: null } },
      select: {
        id: true,
        name: true,
        title: true,
        cardNumber: true,
        cardGroupId: true,
      },
      orderBy: { cardNumber: 'asc' },
    });

    const { searchParams } = new URL(req.url);

    // ─── Single QR for one guest ─────────────────────────────────
    const guestId = searchParams.get('guestId');
    if (guestId) {
      const guest = guests.find((g) => g.id === guestId);
      if (!guest?.cardNumber) {
        return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
      }
      const qr = await generateQRFromCardNumber(guest.cardNumber, SINGLE_QR_SIZE);
      return new NextResponse(new Uint8Array(qr), {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `inline; filename="qr-${guest.cardNumber}.png"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ─── Printable A4 sheet ──────────────────────────────────────
    if (searchParams.has('sheet')) {
      if (guests.length === 0) {
        return NextResponse.json(
          {
            error:
              'No guests have card numbers yet. Add or import guests, then try again.',
          },
          { status: 400 }
        );
      }

      const rawPage = searchParams.get('page') || '1';
      const page = Number(rawPage);
      if (!Number.isInteger(page) || page < 1) {
        return NextResponse.json({ error: 'Invalid page number' }, { status: 400 });
      }

      const pageCount = Math.ceil(guests.length / QR_SHEET_PAGE_SIZE);
      if (page > pageCount) {
        return NextResponse.json({ error: 'Page out of range' }, { status: 400 });
      }

      const slice = guests.slice(
        (page - 1) * QR_SHEET_PAGE_SIZE,
        page * QR_SHEET_PAGE_SIZE
      );
      const entries = await Promise.all(
        slice.map(async (g) => ({
          qr: await generateQRFromCardNumber(g.cardNumber!, SHEET_QR_SIZE),
          cardNumber: g.cardNumber!,
          label: g.title ? `${g.title} ${g.name}` : g.name,
        }))
      );

      const sheet = await buildQrPrintSheet(entries);
      return new NextResponse(new Uint8Array(sheet), {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': 'inline; filename="qr-stickers.png"',
          'Cache-Control': 'no-store',
        },
      });
    }

    // ─── Manifest (one sticker per unique card number) ───────────
    const byNumber = new Map<string, (typeof guests)[number]>();
    for (const g of guests) {
      if (g.cardNumber && !byNumber.has(g.cardNumber)) {
        byNumber.set(g.cardNumber, g);
      }
    }
    const reps = [...byNumber.values()].map((g) => ({
      id: g.id,
      name: g.title ? `${g.title} ${g.name}` : g.name,
      cardNumber: g.cardNumber as string,
    }));

    return NextResponse.json({
      guests: reps,
      total: reps.length,
      perPage: QR_SHEET_PAGE_SIZE,
    });
  } catch (error) {
    console.error('[QR codes] Failed:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Something went wrong generating QR codes',
      },
      { status: 500 }
    );
  }
}