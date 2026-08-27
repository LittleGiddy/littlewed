// app/api/invitations/send-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWeddingInvitation } from '@/lib/whatsapp/index';
import { sendSMS } from '@/lib/sms/index';
import { generateAndStoreCardForGuest } from '@/lib/image-storage';

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
    const { 
      eventId, 
      guestIds, 
      smsTemplate, 
      smsVariables, 
      whatsappVariables, 
      message, 
      retry 
    } = await req.json();

    if (!eventId || !guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
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

    // ─── Check credits before sending ─────────────────────────────────
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { credits: true, bypassPayment: true },
    });

    if (!tenant?.bypassPayment) {
      const creditsNeeded = guests.length;
      if ((tenant?.credits ?? 0) < creditsNeeded) {
        return NextResponse.json({
          error: `Insufficient credits to send ${creditsNeeded} invitations. You have ${tenant?.credits ?? 0} credits. Request more from the admin.`,
          creditsNeeded,
          creditsAvailable: tenant?.credits ?? 0,
        }, { status: 400 });
      }
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
              cardImageUrl = await generateAndStoreCardForGuest(guest.id);
            } catch (error) {
              console.error(`[Batch] Failed to generate card image for ${guest.name}:`, error);
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

            // ─── Get WhatsApp variables ──────────────────────────────────
            const vars = whatsappVariables || {};

            // ─── Replace with actual guest data ──────────────────────────
            const actualGuestName = guestFullName;
            const actualCardNumber = guest.cardNumber || vars.cardNumber || '108';
            const actualCardType = guest.guestType || vars.cardType || 'SINGLE';

            // ─── Send WhatsApp ────────────────────────────────────────────
            result = await sendWeddingInvitation(guest.phone!, {
              guestName: actualGuestName,
              hostFamily: vars.hostFamily || guest.event?.hostFamily || 'Mr & Mrs Allan Swai',
              person1: vars.person1 || guest.event?.person1 || 'Agape',
              person2: vars.person2 || guest.event?.person2 || 'Gladness',
              date: vars.date || formattedDate,
              venue: vars.venue || guest.event?.venue || 'The Embassy Hall',
              time: vars.time || guest.event?.time || '5:00 PM',
              cardNumber: actualCardNumber,
              cardType: actualCardType,
              imageUrl: cardImageUrl,
              inviteLink: inviteLink,
            });

          } else {
            // ─── SMS ──────────────────────────────────────────────────────
            console.log(`[Batch] Sending SMS to ${guest.name} (${guest.phone})`);

            // ─── Get SMS variables & build message from the user's template ─
            const vars = smsVariables || {};

            const actualGuestName = guestFullName;
            const actualCardNumber = guest.cardNumber || vars.cardNumber || '108';
            const actualCardType = guest.guestType || vars.cardType || 'SINGLE';

            // ─── Base template: prefer the SMS template edited by the user ──
            let smsTemplateText =
              smsTemplate ||
              message ||
              `Habari {fullName},\n\nFamilia ya {hostFamily} inakualika katika harusi ya {person1} na {person2} tarehe {date}.\n\nVenue: {venue}, saa {time}.\n\nCard No: {cardNumber} • {guestType}\n\nTafadhali onyesha kadi hii wakati wa kuingia.\nKaribu na ufurahie sherehe!\n\nAhsante.`;

            // ─── Replace variables with actual values ──────────────────────
            let smsMessage = smsTemplateText
              .replace(/{guestName}/g, actualGuestName)
              .replace(/{guestTitle}/g, guest.title || '')
              .replace(/{title}/g, guest.title || '')
              .replace(/{name}/g, guest.name)
              .replace(/{fullName}/g, actualGuestName)
              .replace(/{cardNumber}/g, actualCardNumber)
              .replace(/{cardNo}/g, actualCardNumber)
              .replace(/{guestType}/g, actualCardType)
              .replace(/{cardType}/g, actualCardType)
              .replace(/{passCode}/g, guest.passCode || 'N/A')
              .replace(/{event}/g, guest.event?.name || '')
              .replace(/{date}/g, formattedDate)
              .replace(/{eventDate}/g, formattedDate)
              .replace(/{venue}/g, vars.venue || guest.event?.venue || '')
              .replace(/{address}/g, guest.event?.address || '')
              .replace(/{hostFamily}/g, vars.hostFamily || guest.event?.hostFamily || '')
              .replace(/{person1}/g, vars.person1 || guest.event?.person1 || '')
              .replace(/{person2}/g, vars.person2 || guest.event?.person2 || '')
              .replace(/{time}/g, vars.time || guest.event?.time || '');

            // ─── Send SMS ──────────────────────────────────────────────────
            const smsResult = await sendSMS({
              to: guest.phone!,
              message: smsMessage,
            });

            result = {
              success: smsResult.success,
              error: smsResult.error,
              data: smsResult.data,
              messageId: smsResult.messageId,
            };
          }

          // ─── Handle result ─────────────────────────────────────────────
          if (result.success) {
            successCount++;

            // ─── Deduct 1 credit per invitation sent (skip if bypassPayment) ─
            if (!tenant?.bypassPayment) {
              await prisma.tenant.update({
                where: { id: tenantId },
                data: { credits: { decrement: 1 } },
              });
            }

            // ─── Log credit usage ─────────────────────────────────────────
            await prisma.usageRecord.create({
              data: {
                tenantId,
                eventId,
                channel: guest.routingChannel === 'whatsapp' ? 'whatsapp' : 'sms',
                cost: 1,
              },
            });

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
                  template: guest.routingChannel === 'whatsapp' ? 'swahili_invitation' : 'custom',
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
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}