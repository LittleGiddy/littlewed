// app/api/invitations/send-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWeddingInvitation } from '@/lib/whatsapp/index';
import { sendSMS } from '@/lib/sms';
import { generateAndStoreCardImage, getCardImageUrl } from '@/lib/image-storage';

const BATCH_SIZE = 5;
const BATCH_DELAY = 2000;
const MESSAGE_DELAY = 500;

export async function POST(req: NextRequest) {
  try {
    // ─── Parse JSON body ──────────────────────────────────────────────
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[Batch] Failed to parse JSON:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { 
      eventId, 
      guestIds, 
      smsVariables, 
      whatsappVariables, 
      message, 
      retry 
    } = body;

    // ─── Validate required fields ──────────────────────────────────────
    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
      return NextResponse.json(
        { error: 'Guest IDs are required' },
        { status: 400 }
      );
    }

    // ─── Check authentication ──────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = (session.user as any).tenantId;

    // ─── Fetch guests with events ──────────────────────────────────────
    const guests = await prisma.guest.findMany({
      where: { 
        id: { in: guestIds }, 
        event: { tenantId },
      },
      include: { event: true },
    });

    if (guests.length === 0) {
      return NextResponse.json(
        { error: 'No guests found' },
        { status: 404 }
      );
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

          // ─── Ensure guest has a pass code ──────────────────────────────
          if (!guest.passCode) {
            console.warn(`[Batch] Guest ${guest.name} has no pass code, skipping`);
            results.push({
              guestId: guest.id,
              name: guest.name,
              success: false,
              error: 'No pass code generated. Please generate cards first.',
              channel: guest.routingChannel,
            });
            failCount++;
            continue;
          }

          // ─── Ensure card image exists ──────────────────────────────────
          let cardImageUrl = guest.invitationCard;

          if (!cardImageUrl) {
            try {
              cardImageUrl = await generateAndStoreCardImage(guest.id);
            } catch (error) {
              console.error(`[Batch] Failed to generate card image for ${guest.name}:`, error);
              cardImageUrl = getCardImageUrl(guest.passCode);
            }
          }

          if (!cardImageUrl) {
            cardImageUrl = 'https://www.gstatic.com/webp/gallery/1.png';
          }

          // ─── Build invite link for the button ──────────────────────────
          const inviteLink = `https://littlewed.co.tz/invite/${guest.passCode}`;

          let result;

          // ─── Send via appropriate channel ──────────────────────────
          if (guest.routingChannel === 'whatsapp') {
            console.log(`[Batch] Sending WhatsApp to ${guest.name} (${guest.phone})`);

            const vars = whatsappVariables || {};

            result = await sendWeddingInvitation(guest.phone!, {
              guestName: vars.guestName || guestFullName,
              hostFamily: vars.hostFamily || guest.event?.hostFamily || 'Mr & Mrs Allan Swai',
              person1: vars.person1 || guest.event?.person1 || 'Agape',
              person2: vars.person2 || guest.event?.person2 || 'Gladness',
              date: vars.date || formattedDate,
              venue: vars.venue || guest.event?.venue || 'The Embassy Hall',
              time: vars.time || guest.event?.time || '5:00 PM',
              cardNumber: vars.cardNumber || guest.cardNumber || '108',
              cardType: vars.cardType || guest.guestType || 'SINGLE',
              imageUrl: cardImageUrl,
              inviteLink: inviteLink,
            });
          } else {
            // SMS
            console.log(`[Batch] Sending SMS to ${guest.name} (${guest.phone})`);

            const vars = smsVariables || {};

            let smsMessage = `Habari ${vars.guestName || guestFullName},

Familia ya ${vars.hostFamily || guest.event?.hostFamily || 'Mr & Mrs Allan Swai'} inakualika katika harusi ya ${vars.person1 || guest.event?.person1 || 'Agape'} na ${vars.person2 || guest.event?.person2 || 'Gladness'} tarehe ${vars.date || formattedDate}.

Venue: ${vars.venue || guest.event?.venue || 'The Embassy Hall'}, saa ${vars.time || guest.event?.time || '5:00 PM'}.

Card No: ${vars.cardNumber || guest.cardNumber || '108'} • ${vars.cardType || guest.guestType || 'SINGLE'}

Tafadhali onyesha kadi hii wakati wa kuingia.
Karibu na ufurahie sherehe!

Ahsante.`;

            if (message) {
              smsMessage = message
                .replace(/{title}/g, guest.title || '')
                .replace(/{name}/g, guest.name)
                .replace(/{fullName}/g, guestFullName)
                .replace(/{cardNumber}/g, guest.cardNumber || 'N/A')
                .replace(/{passCode}/g, guest.passCode || 'N/A')
                .replace(/{event}/g, guest.event?.name || '')
                .replace(/{date}/g, formattedDate)
                .replace(/{venue}/g, guest.event?.venue || '')
                .replace(/{address}/g, guest.event?.address || '')
                .replace(/{hostFamily}/g, guest.event?.hostFamily || '')
                .replace(/{person1}/g, guest.event?.person1 || '')
                .replace(/{person2}/g, guest.event?.person2 || '')
                .replace(/{time}/g, guest.event?.time || '');
            }

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
                  rawData: result.data || {},
                },
              });
            }
          } else {
            failCount++;
            console.error(`[Batch] Failed to send to ${guest.name}:`, result.error);
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
    console.error('[Batch] Unhandled error:', error);
    // ─── Always return JSON, never HTML ──────────────────────────────
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}