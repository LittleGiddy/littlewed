// app/api/invitations/generate-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createCanvas, loadImage } from 'canvas';
import QRCode from 'qrcode';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { eventId, guestIds } = await req.json();

    if (!eventId || !guestIds || !Array.isArray(guestIds)) {
      return NextResponse.json({ error: 'Event ID and guest IDs are required' }, { status: 400 });
    }

    // ─── Fetch event with all settings ──────────────────────────────────
    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // ─── Fetch guests ──────────────────────────────────────────────────
    const guests = await prisma.guest.findMany({
      where: { id: { in: guestIds }, eventId },
    });

    if (guests.length === 0) {
      return NextResponse.json({ error: 'No guests found' }, { status: 404 });
    }

    // ─── Get design settings from event ──────────────────────────────────
    const templateUrl = event.templateCardUrl;
    const overlayColor = event.overlayColor || '#000000';
    const overlayOpacity = event.overlayOpacity || 0.2;
    const qrX = event.qrPlacementX || 100;
    const qrY = event.qrPlacementY || 100;
    const qrSize = event.qrSize || 200;
    const qrColor = event.qrColor || '#000000';
    const qrRotation = event.qrRotation || 0;
    const designLayers = event.designLayers as any[] || [];

    if (!templateUrl) {
      return NextResponse.json({ 
        error: 'No template selected. Please design a card first.' 
      }, { status: 400 });
    }

    const results = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < guests.length; i += BATCH_SIZE) {
      const batch = guests.slice(i, i + BATCH_SIZE);
      
      for (const guest of batch) {
        try {
          // ─── Generate personalized card ──────────────────────────────
          const cardUrl = await generatePersonalizedCard({
            templateUrl,
            guest,
            event,
            designLayers,
            overlayColor,
            overlayOpacity,
            qrX,
            qrY,
            qrSize,
            qrColor,
            qrRotation,
          });

          // ─── Update guest with card URL ──────────────────────────────
          await prisma.guest.update({
            where: { id: guest.id },
            data: { invitationCard: cardUrl },
          });

          results.push({
            guestId: guest.id,
            name: guest.name,
            success: true,
            cardUrl,
          });

        } catch (error: any) {
          console.error(`Failed to generate card for ${guest.name}:`, error.message);
          results.push({
            guestId: guest.id,
            name: guest.name,
            success: false,
            error: error.message,
          });
        }
      }

      // Small delay between batches
      if (i + BATCH_SIZE < guests.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const completed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      completed,
      failed,
      results,
    });

  } catch (error: any) {
    console.error('Generate batch error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── Generate personalized card ──────────────────────────────────────────
async function generatePersonalizedCard({
  templateUrl,
  guest,
  event,
  designLayers,
  overlayColor,
  overlayOpacity,
  qrX,
  qrY,
  qrSize,
  qrColor,
  qrRotation,
}: {
  templateUrl: string;
  guest: any;
  event: any;
  designLayers: any[];
  overlayColor: string;
  overlayOpacity: number;
  qrX: number;
  qrY: number;
  qrSize: number;
  qrColor: string;
  qrRotation: number;
}): Promise<string> {
  // ─── Load the template image ──────────────────────────────────────────
  const response = await fetch(templateUrl);
  const buffer = await response.arrayBuffer();
  
  // ─── Create canvas with the template ──────────────────────────────────
  const image = await loadImage(Buffer.from(buffer));
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  // ─── Draw template ──────────────────────────────────────────────────
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // ─── Apply overlay ──────────────────────────────────────────────────
  if (overlayOpacity > 0) {
    ctx.fillStyle = overlayColor;
    ctx.globalAlpha = overlayOpacity;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  // ─── Process design layers ────────────────────────────────────────────
  const guestName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
  const eventDate = event.date ? new Date(event.date).toLocaleDateString('sw-TZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) : '';

  for (const layer of designLayers) {
    if (!layer.visible) continue;

    const x = (layer.x / 100) * canvas.width;
    const y = (layer.y / 100) * canvas.height;

    if (layer.type === 'text') {
      let text = layer.text;
      
      // ─── Replace placeholders ──────────────────────────────────────
      if (layer.isGuestName) {
        text = guestName;
      } else if (layer.isGuestType) {
        text = guest.title || guest.guestType || '';
      } else if (layer.isCardNumber) {
        text = guest.cardNumber || '';
      } else {
        // Replace any remaining placeholders
        text = text
          .replace(/{guestName}/g, guestName)
          .replace(/{guestTitle}/g, guest.title || '')
          .replace(/{cardNumber}/g, guest.cardNumber || '')
          .replace(/{eventName}/g, event.name || '')
          .replace(/{eventDate}/g, eventDate)
          .replace(/{venue}/g, event.venue || '');
      }

      const fontSize = layer.fontSize || 24;
      const fontFamily = layer.fontFamily || 'Playfair Display';
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((layer.rotation || 0) * Math.PI / 180);
      ctx.textAlign = layer.align || 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${fontSize}px "${fontFamily}"`;
      
      // ─── Shadow ──────────────────────────────────────────────────────
      if (layer.shadow) {
        ctx.shadowColor = layer.shadow.color || 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = layer.shadow.blur || 4;
        ctx.shadowOffsetX = layer.shadow.offsetX || 0;
        ctx.shadowOffsetY = layer.shadow.offsetY || 2;
      }
      
      ctx.fillStyle = layer.color || '#ffffff';
      
      // ─── Multi-line text support ────────────────────────────────────
      const lines = text.split('\n');
      const lineHeight = fontSize * 1.4;
      const totalHeight = lines.length * lineHeight;
      const startY = -(totalHeight / 2) + (lineHeight / 2);
      
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 0, startY + i * lineHeight);
      }
      
      ctx.restore();
    }

    if (layer.type === 'rect') {
      const width = (layer.width / 100) * canvas.width;
      const height = (layer.height / 100) * canvas.height;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((layer.rotation || 0) * Math.PI / 180);
      
      if (layer.fill) {
        ctx.fillStyle = layer.fill;
        ctx.fillRect(-width/2, -height/2, width, height);
      }
      
      if (layer.borderWidth > 0 && layer.borderColor) {
        ctx.strokeStyle = layer.borderColor;
        ctx.lineWidth = layer.borderWidth;
        ctx.strokeRect(-width/2, -height/2, width, height);
      }
      
      ctx.restore();
    }

    if (layer.type === 'line') {
      const startX = (layer.startX / 100) * canvas.width;
      const startY = (layer.startY / 100) * canvas.height;
      const endX = (layer.endX / 100) * canvas.width;
      const endY = (layer.endY / 100) * canvas.height;
      
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = layer.strokeColor || '#ffffff';
      ctx.lineWidth = layer.strokeWidth || 2;
      
      if (layer.dashArray === 'dashed') {
        ctx.setLineDash([5, 5]);
      } else if (layer.dashArray === 'dotted') {
        ctx.setLineDash([2, 4]);
      }
      
      ctx.stroke();
      ctx.restore();
    }
  }

  // ─── Generate and add QR Code ────────────────────────────────────────
  const qrCodeDataUrl = await generateQRCode({
    guestId: guest.id,
    eventId: event.id,
    cardNumber: guest.cardNumber,
    qrSize,
    qrColor,
  });

  if (qrCodeDataUrl) {
    try {
      const qrImage = await loadImage(Buffer.from(qrCodeDataUrl.split(',')[1], 'base64'));
      const qrWidth = Math.min(qrSize, 300);
      const qrHeight = Math.min(qrSize, 300);
      const qrXPos = (qrX / 100) * canvas.width;
      const qrYPos = (qrY / 100) * canvas.height;
      
      ctx.save();
      ctx.translate(qrXPos, qrYPos);
      ctx.rotate((qrRotation || 0) * Math.PI / 180);
      ctx.drawImage(qrImage, -qrWidth/2, -qrHeight/2, qrWidth, qrHeight);
      ctx.restore();
    } catch (error) {
      console.error('QR Code drawing error:', error);
    }
  }

  // ─── Convert to PNG and upload ──────────────────────────────────────
  const pngBuffer = canvas.toBuffer('image/png');
  
  // ─── Upload to storage ──────────────────────────────────────────────
  // For now, return base64 for testing
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

// ─── Generate QR Code ──────────────────────────────────────────────────
async function generateQRCode({
  guestId,
  eventId,
  cardNumber,
  qrSize,
  qrColor,
}: {
  guestId: string;
  eventId: string;
  cardNumber?: string | null;
  qrSize: number;
  qrColor: string;
}): Promise<string | null> {
  try {
    const data = JSON.stringify({
      guestId,
      eventId,
      cardNumber: cardNumber || 'unknown',
      checkInUrl: `https://littlewed.co.tz/check-in?guest=${guestId}&event=${eventId}`,
    });

    // ─── Fix: Use toCanvas instead of toDataURL for better type support ──
    const canvas = createCanvas(
      Math.min(qrSize * 2, 400),
      Math.min(qrSize * 2, 400)
    );
    
    await QRCode.toCanvas(canvas, data, {
      width: Math.min(qrSize * 2, 400),
      color: {
        dark: qrColor || '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });

    // Convert canvas to data URL
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('QR Code generation error:', error);
    return null;
  }
}