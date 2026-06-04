import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateGuestToken, generateQRBuffer, compositeQROnCard } from '@/lib/qr';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const isCloudflareTunnel =
    host.includes('trycloudflare.com') || host.includes('loca.lt');

  // ── Auth ──────────────────────────────────────────────────────────
  let session = null;
  if (!isCloudflareTunnel) {
    session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { eventId } = await req.json();

  // ── Fetch event with guests only ──────────────────────────────────
  // ✅ removed `include: { tenant: { include: { settings: true } } }`
  // because TenantSettings model no longer exists — fields are on Tenant directly
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      guests: true, // ✅ guests is a direct relation on Event — this is fine
    },
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // ── Verify ownership (non-tunnel) ─────────────────────────────────
  if (!isCloudflareTunnel && session) {
    const tenantId = (session.user as any).tenantId;
    if (
      event.tenantId !== tenantId &&
      (session.user as any).role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // ── Fetch tenant settings directly from Tenant model ─────────────
  // ✅ query Tenant directly — templateCardUrl, qrPlacementX/Y/Size are on Tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: event.tenantId },
    select: {
      templateCardUrl: true,
      qrPlacementX:    true,
      qrPlacementY:    true,
      qrSize:          true,
    },
  });

  if (!tenant?.templateCardUrl) {
    return NextResponse.json(
      { error: 'No invitation card configured for this tenant. Please upload a base card in Settings.' },
      { status: 400 }
    );
  }

  const qrPosition = {
    x:    tenant.qrPlacementX ?? 100,
    y:    tenant.qrPlacementY ?? 100,
    size: tenant.qrSize       ?? 200,
  };

  // ── Read base card from filesystem ────────────────────────────────
  const baseCardPath = path.join(process.cwd(), 'public', tenant.templateCardUrl);

  try {
    await fs.access(baseCardPath);
  } catch {
    return NextResponse.json(
      { error: `Base card image not found at: ${tenant.templateCardUrl}` },
      { status: 400 }
    );
  }

  const cardBuffer = await fs.readFile(baseCardPath);

  // ── Generate cards for each guest ─────────────────────────────────
  const results = [];

  for (const guest of event.guests) {
    try {
      // 1. Generate JWT token
      const token = generateGuestToken(guest.id, eventId);

      // 2. Generate QR buffer
      const qrBuffer = await generateQRBuffer(token, qrPosition.size);

      // 3. Composite QR onto card
      const finalCardBuffer = await compositeQROnCard(cardBuffer, qrBuffer, qrPosition);

      // 4. Convert to base64
      const base64Card = finalCardBuffer.toString('base64');

      // 5. Upload to public folder
      const uploadRes = await fetch(`${process.env.NEXTAUTH_URL}/api/upload-guest-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: guest.id, base64Image: base64Card }),
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      const { url: relativeUrl } = await uploadRes.json();

      // 6. Build absolute URL for Twilio
      const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
      const absoluteUrl = `${baseUrl}${relativeUrl}`;

      // 7. Save to guest record
      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationCard: absoluteUrl, qrToken: token },
      });

      results.push({ guestId: guest.id, name: guest.name, success: true });
    } catch (error: any) {
      console.error(`Failed for ${guest.name}:`, error);
      results.push({
        guestId: guest.id,
        name: guest.name,
        success: false,
        error: error.message,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const successCount = results.filter(r => r.success).length;
  const failCount    = results.filter(r => !r.success).length;

  return NextResponse.json({
    success: true,
    total:     results.length,
    generated: successCount,
    failed:    failCount,
    results,
  });
}