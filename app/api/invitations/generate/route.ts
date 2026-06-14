import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateGuestToken, generateQRBuffer, compositeQROnCard } from '@/lib/qr';
import { put } from '@vercel/blob';

export async function POST(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const isCloudflareTunnel = host.includes('trycloudflare.com') || host.includes('loca.lt');

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
    if (event.tenantId !== tenantId && (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Use the event's own card settings
  if (!event.templateCardUrl) {
    return NextResponse.json(
      { error: 'No invitation card configured for this event. Please design it first.' },
      { status: 400 }
    );
  }

  const qrPosition = {
    x: event.qrPlacementX ?? 100,
    y: event.qrPlacementY ?? 100,
    size: event.qrSize ?? 200,
  };

  const namePosition = event.includeName
    ? {
        x: event.namePlacementX ?? 50,
        y: event.namePlacementY ?? 50,
        fontSize: event.nameFontSize ?? 24,
        fontColor: event.nameFontColor ?? '#000000',
      }
    : undefined;

  // Fetch the base card from its public Blob URL
  let cardBuffer: Buffer;
  try {
    const response = await fetch(event.templateCardUrl);
    if (!response.ok) throw new Error(`Failed to fetch base card: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    cardBuffer = Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error fetching base card:', error);
    return NextResponse.json(
      { error: 'Could not load base card image. Please re‑upload the template.' },
      { status: 400 }
    );
  }

  const results = [];

  for (const guest of event.guests) {
    try {
      const token = generateGuestToken(guest.id, eventId);
      const qrBuffer = await generateQRBuffer(token, qrPosition.size);
      const finalCardBuffer = await compositeQROnCard(
        cardBuffer,
        qrBuffer,
        qrPosition,
        namePosition,
        event.includeName ? guest.name : undefined
      );

      const key = `guests/${event.tenantId}/${guest.id}.png`;
      const blob = await put(key, finalCardBuffer, {
        access: 'public',
        contentType: 'image/png',    
      });

      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationCard: blob.url, qrToken: token },
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