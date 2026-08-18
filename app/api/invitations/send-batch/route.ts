// app/api/invitations/send-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWeddingInvitation } from '@/lib/whatsapp/index';
import { sendSMS } from '@/lib/sms';

const BATCH_SIZE = 5;
const BATCH_DELAY = 2000;
const MESSAGE_DELAY = 500;

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

    // ─── Fetch guests with events ──────────────────────────────────────
    const guests = await prisma.guest.findMany({
      where: { 
        id: { in: guestIds }, 
        event: { tenantId },
      },
      include: { event: true },
    });

    if (guests.length === 0) {
      return NextResponse.json({ error: 'No guests found' }, { status: 404 });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    // ─── Process in batches ────────────────────────────────────────────
    for (let i = 0; i < guests.length; i += BATCH_SIZE) {
      const batch = guests.slice(i, i + BATCH_SIZE);
      console.log(`[Batch] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(guests.length / BATCH_SIZE)}`);

      for (const guest of batch) {
        try {
          // ─── Build common data ──────────────────────────────────────
          const guestFullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
          const formattedDate = guest.event?.date
            ? new Date(guest.event.date).toLocaleDateString('sw-TZ', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : '';

          // ─── Dynamic card URL using pass code ──────────────────────
          const cardImageUrl = guest.passCode 
            ? `https://littlewed.co.tz/api/og/card?code=${guest.passCode}`
            : guest.invitationCard || guest.event?.imageUrl || 'https://www.gstatic.com/webp/gallery/1.png';

          let result;

          // ─── Send via appropriate channel ──────────────────────────
          if (guest.routingChannel === 'whatsapp') {
            result = await sendWeddingInvitation(guest.phone!, {
              guestName: guestFullName,
              hostFamily: guest.event?.hostFamily || 'Mr & Mrs Allan Swai',
              person1: guest.event?.person1 || 'Agape',
              person2: guest.event?.person2 || 'Gladness',
              date: formattedDate,
              venue: guest.event?.venue || 'The Embassy Hall',
              time: guest.event?.time || '5:00 PM',
              cardNumber: guest.cardNumber || '108',
              cardType: guest.guestType || 'SINGLE',
              imageUrl: cardImageUrl,
              // No inviteLink - removed!
            });
          } else {
            // SMS (no link)
            const smsMessage = `Habari ${guestFullName},

Familia ya ${guest.event?.hostFamily || 'Mr & Mrs Allan Swai'} inakualika katika harusi ya ${guest.event?.person1 || 'Agape'} na ${guest.event?.person2 || 'Gladness'} tarehe ${formattedDate}.

Venue: ${guest.event?.venue || 'The Embassy Hall'}, saa ${guest.event?.time || '5:00 PM'}.

Card No: ${guest.cardNumber || '108'} • ${guest.guestType || 'SINGLE'}

Tafadhali onyesha kadi hii wakati wa kuingia.
Karibu na ufurahie sherehe!

Ahsante.`;

            result = await sendSMS({
              to: guest.phone!,
              message: smsMessage,
            });
          }

          if (result.success) {
            successCount++;
            await prisma.guest.update({
              where: { id: guest.id },
              data: { invitationSentAt: new Date() },
            });

            if (result.messageId) {
              await prisma.messageLog.create({
                data: {
                  messageId: result.messageId,
                  guestId: guest.id,
                  type: guest.routingChannel === 'whatsapp' ? 'WHATSAPP' : 'SMS',
                  template: guest.routingChannel === 'whatsapp' ? 'swahili invitation' : 'custom',
                  status: 'SENT',
                  rawData: result.data,
                },
              });
            }
          } else {
            failCount++;
          }

          results.push({
            guestId: guest.id,
            name: guest.name,
            success: result.success,
            error: result.error,
            channel: guest.routingChannel,
          });

        } catch (error: any) {
          failCount++;
          console.error(`[Batch] Error sending to ${guest.name}:`, error.message);
          results.push({
            guestId: guest.id,
            name: guest.name,
            success: false,
            error: error.message || 'Unknown error',
            channel: guest.routingChannel,
          });
        }

        // ─── Small delay between messages ──────────────────────────────
        await new Promise(r => setTimeout(r, MESSAGE_DELAY));
      }

      // ─── Delay between batches ──────────────────────────────────────
      if (i + BATCH_SIZE < guests.length) {
        console.log(`[Batch] Waiting ${BATCH_DELAY}ms before next batch...`);
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }

    return NextResponse.json({
      success: true,
      total: guests.length,
      successCount,
      failCount,
      results,
    });

  } catch (error: any) {
    console.error('Batch send error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}