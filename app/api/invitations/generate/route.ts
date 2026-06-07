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

  let session = null;
  if (!isCloudflareTunnel) {
    session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { eventId } = await req.json();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { guests: true },
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  if (!isCloudflareTunnel && session) {
    const tenantId = (session.user as any).tenantId;
    if (
      event.tenantId !== tenantId &&
      (session.user as any).role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: event.tenantId },
    select: {
      templateCardUrl: true,
      qrPlacementX: true,
      qrPlacementY: true,
      qrSize: true,
    },
  });

  if (!tenant?.templateCardUrl) {
    return NextResponse.json(
      { error: 'No invitation card configured for this tenant. Please upload a base card in Settings.' },
      { status: 400 }
    );
  }

  const qrPosition = {
    x: tenant.qrPlacementX ?? 100,
    y: tenant.qrPlacementY ?? 100,
    size: tenant.qrSize ?? 200,
  };

  // The baseCardUrl is now a full blob URL (public). We need to fetch it as buffer.
  let cardBuffer: Buffer;
  try {
    const response = await fetch(tenant.templateCardUrl);
    if (!response.ok) throw new Error(`Failed to fetch base card: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    cardBuffer = Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error fetching base card:', error);
    return NextResponse.json(
      { error: 'Could not load base card image. Please re‑upload the template in Settings.' },
      { status: 400 }
    );
  }

  const results = [];

  for (const guest of event.guests) {
    try {
      const token = generateGuestToken(guest.id, eventId);
      const qrBuffer = await generateQRBuffer(token, qrPosition.size);
      const finalCardBuffer = await compositeQROnCard(cardBuffer, qrBuffer, qrPosition);
      const base64Card = finalCardBuffer.toString('base64');

      // Upload using the guest card API (which now uses Vercel Blob)
      const uploadRes = await fetch(`${process.env.NEXTAUTH_URL}/api/upload-guest-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: guest.id, base64Image: base64Card }),
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      const { url: imageUrl } = await uploadRes.json(); // This is now a full blob URL

      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationCard: imageUrl, qrToken: token },
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
  const failCount = results.filter(r => !r.success).length;

  return NextResponse.json({
    success: true,
    total: results.length,
    generated: successCount,
    failed: failCount,
    results,
  });
}