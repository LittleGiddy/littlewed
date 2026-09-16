import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface SessionUser {
  role?: string;
  tenantId?: string;
}

async function authorizeEvent(eventId: string) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const role = (session.user as SessionUser)?.role;
  const tenantId = (session.user as SessionUser)?.tenantId;

  if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!tenantId) {
    return { error: NextResponse.json({ error: 'Missing tenant context' }, { status: 400 }) };
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };
  }
  if (role !== 'SUPER_ADMIN' && event.tenantId !== tenantId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session, tenantId, event };
}

const GUEST_PAGE_FIELDS = [
  'guestPagePrimaryColor',
  'guestPageSecondaryColor',
  'guestPageAccentColor',
  'guestPageThemeColor',
  'guestPageFontFamily',
  'guestPageHeaderImage',
  'guestPageCoupleImage',
  'guestPageTitle',
  'guestPageSubtitle',
  'guestPageDetailsTitle',
  'guestPageRsvpTitle',
  'guestPageFooterNote',
  // New per-event invitee page content
  'weddingTheme',
  'contactPerson',
  'contactPersonPhone',
  'masterOfCeremony',
  'mapUrl',
] as const;

// GET - effective guest page settings for one event (event ?? tenant ?? default)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const auth = await authorizeEvent(eventId);
    if (auth.error) return auth.error;

    const event = auth.event!;
    const tenant = await prisma.tenant.findUnique({ where: { id: event.tenantId } });
    const pick = (key: (typeof GUEST_PAGE_FIELDS)[number], fallback: string) => {
      const eventRow = event as unknown as Record<string, unknown>;
      const tenantRow = tenant as unknown as Record<string, unknown> | null;
      const v = eventRow[key] ?? tenantRow?.[key];
      return typeof v === 'string' && v.trim() !== '' ? v : fallback;
    };
    const pickNullable = (key: (typeof GUEST_PAGE_FIELDS)[number]) => {
      const eventRow = event as unknown as Record<string, unknown>;
      const tenantRow = tenant as unknown as Record<string, unknown> | null;
      const v = eventRow[key] ?? tenantRow?.[key];
      return typeof v === 'string' && v.trim() !== '' ? v : '';
    };
    const pickColors = () => {
      const eventRow = event as unknown as Record<string, unknown>;
      const tenantRow = tenant as unknown as Record<string, unknown> | null;
      const colors = eventRow['themeColors'] ?? tenantRow?.['themeColors'];
      if (Array.isArray(colors)) {
        return (colors as unknown[]).filter((c): c is string => typeof c === 'string' && c.trim() !== '').slice(0, 6);
      }
      return [];
    };

    return NextResponse.json({
      guestPagePrimaryColor: pick('guestPagePrimaryColor', '#BE185D'),
      guestPageSecondaryColor: pick('guestPageSecondaryColor', '#6D28D9'),
      guestPageAccentColor: pick('guestPageAccentColor', '#F6C445'),
      guestPageThemeColor: pick('guestPageThemeColor', '#E8C46B'),
      guestPageFontFamily: pick('guestPageFontFamily', 'Playfair Display'),
      guestPageHeaderImage: pickNullable('guestPageHeaderImage'),
      guestPageCoupleImage: pickNullable('guestPageCoupleImage'),
      guestPageTitle: pickNullable('guestPageTitle'),
      guestPageSubtitle: pickNullable('guestPageSubtitle'),
      guestPageDetailsTitle: pick('guestPageDetailsTitle', 'The Invitation'),
      guestPageRsvpTitle: pick('guestPageRsvpTitle', 'Will You Attend?'),
      guestPageFooterNote: pick('guestPageFooterNote', 'With love'),
      weddingTheme: pickNullable('weddingTheme'),
      themeColors: pickColors(),
      contactPerson: pickNullable('contactPerson'),
      contactPersonPhone: pickNullable('contactPersonPhone'),
      masterOfCeremony: pickNullable('masterOfCeremony'),
      mapUrl: pickNullable('mapUrl'),
    });
  } catch (error) {
    console.error('GET /api/events/[eventId]/guest-page error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - save guest page settings for one event
export async function PUT(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const auth = await authorizeEvent(eventId);
    if (auth.error) return auth.error;

    const body = await req.json();
    const data: Record<string, string | null | string[]> = {};
    for (const key of GUEST_PAGE_FIELDS) {
      const raw = body[key];
      if (typeof raw === 'string') {
        data[key] =
          key === 'guestPageHeaderImage' || key === 'guestPageCoupleImage' ||
          key === 'guestPageTitle' || key === 'guestPageSubtitle' ||
          key === 'guestPageDetailsTitle' || key === 'guestPageRsvpTitle' ||
          key === 'guestPageFooterNote' ||
          key === 'weddingTheme' || key === 'contactPerson' ||
          key === 'contactPersonPhone' || key === 'masterOfCeremony' ||
          key === 'mapUrl'
            ? raw.trim() === '' ? null : raw.trim()
            : raw.trim();
      }
    }
    if (Array.isArray(body.themeColors)) {
      data.themeColors = body.themeColors
        .filter((c: unknown): c is string => typeof c === 'string')
        .map((c: string) => c.trim())
        .filter((c: string) => c !== '')
        .slice(0, 6);
    } else if (typeof body.themeColors === 'string') {
      data.themeColors = body.themeColors
        .split(',')
        .map((c: string) => c.trim())
        .filter(Boolean)
        .slice(0, 6);
    }

    await prisma.event.update({
      where: { id: eventId },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/events/[eventId]/guest-page error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}