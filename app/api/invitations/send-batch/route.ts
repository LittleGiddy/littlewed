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
      retry,
      whatsappTemplate,
      whatsappContact,
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
            cardImageUrl = '';
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
            const actualCardNumber = guest.cardNumber || vars.cardNumber || '';
            const actualCardType = guest.guestType || vars.cardType || '';

            // ─── Send WhatsApp ────────────────────────────────────────────
            // Variable values come from the user's inputs (whatsappVariables),
            // then the event data — no hardcoded fallbacks.
            result = await sendWeddingInvitation(guest.phone!, {
              guestName: actualGuestName,
              hostFamily: vars.hostFamily || guest.event?.hostFamily || '',
              person1: vars.person1 || guest.event?.person1 || '',
              person2: vars.person2 || guest.event?.person2 || '',
              date: vars.date || formattedDate,
              venue: vars.venue || guest.event?.venue || '',
              time: vars.time || guest.event?.time || '',
              cardNumber: actualCardNumber,
              cardType: actualCardType,
              imageUrl: cardImageUrl || undefined,
              inviteLink: inviteLink,
              templateName: whatsappTemplate,
              contact: whatsappContact,
            });

            // ─── WhatsApp failed → fall back to SMS ──────────────────────
            // Since WhatsApp presence can't be detected ahead of time, if the
            // WhatsApp send fails, automatically retry with SMS and flip the
            // guest's routing so they now appear on the SMS side.
            if (!result.success) {
              console.log(`[Batch] WhatsApp failed for ${guest.name}, falling back to SMS`);

              const fallbackVars = smsVariables || {};
              const cardNumber = guest.cardNumber || fallbackVars.cardNumber || '';
              const guestType =
                guest.guestType === 'DOUBLE' ? 'Double' : guest.guestType === 'SINGLE' ? 'Single' : '';

              const smsTemplateText =
                smsTemplate ||
                message ||
                `Habari {fullName},\n\nFamilia ya {hostFamily} inakualika katika harusi ya {person1} na {person2} tarehe {date}.\n\nVenue: {venue}, saa {time}.\n\nCard No: {cardNumber} • {guestType}\n\nTafadhali onyesha kadi hii wakati wa kuingia.\nKaribu na ufurahie sherehe!\n\nAhsante.`;

              const fallbackMap: Record<string, string> = {
                guestName: actualGuestName,
                guestTitle: guest.title || '',
                title: guest.title || '',
                name: guest.name || '',
                fullName: actualGuestName,
                cardNumber,
                cardNo: cardNumber,
                guestType,
                cardType: guestType,
                passCode: guest.passCode || 'N/A',
                event: guest.event?.name || '',
                date: formattedDate,
                eventDate: formattedDate,
                venue: fallbackVars.venue || guest.event?.venue || '',
                address: guest.event?.address || '',
                hostFamily: fallbackVars.hostFamily || guest.event?.hostFamily || '',
                person1: fallbackVars.person1 || guest.event?.person1 || '',
                person2: fallbackVars.person2 || guest.event?.person2 || '',
                time: fallbackVars.time || guest.event?.time || '',
                contact: whatsappContact || '',
              };

              const fallbackMessage = smsTemplateText.replace(
                /\{(guestName|guestTitle|title|name|fullName|cardNumber|cardNo|guestType|cardType|passCode|event|date|eventDate|venue|address|hostFamily|person1|person2|time|contact)\}/g,
                (m: string, key: string) => fallbackMap[key] ?? m
              );

              const smsFallback = await sendSMS({ to: guest.phone!, message: fallbackMessage });

              if (smsFallback.success) {
                // Flip the guest's routing to SMS so they show on the SMS side
                await prisma.guest.update({
                  where: { id: guest.id },
                  data: { routingChannel: 'sms', onWhatsApp: false, invitationSentAt: new Date() },
                }).catch(() => {});

                result = {
                  success: true,
                  error: undefined,
                  data: { ...(smsFallback.data || {}), fellBackFromWhatsapp: true },
                  messageId: smsFallback.messageId,
                };
              } else {
                result = {
                  success: false,
                  error: result.error || (smsFallback.error || 'WhatsApp failed and SMS fallback failed'),
                  data: { whatsappData: result.data, smsFallbackData: smsFallback.data },
                  messageId: result.messageId,
                };
              }
            }

          } else {
            // ─── SMS ──────────────────────────────────────────────────────
            console.log(`[Batch] Sending SMS to ${guest.name} (${guest.phone})`);

            // ─── Get SMS variables & build message from the user's template ─
            const vars = smsVariables || {};

            const actualGuestName = guestFullName;
            const actualCardNumber = guest.cardNumber || vars.cardNumber || '';
            const actualCardType = guest.guestType || vars.cardType || '';

            // ─── Base template: prefer the SMS template edited by the user ──
            const smsTemplateText =
              smsTemplate ||
              message ||
              `Habari {fullName},\n\nFamilia ya {hostFamily} inakualika katika harusi ya {person1} na {person2} tarehe {date}.\n\nVenue: {venue}, saa {time}.\n\nCard No: {cardNumber} • {guestType}\n\nTafadhali onyesha kadi hii wakati wa kuingia.\nKaribu na ufurahie sherehe!\n\nAhsante.`;

            // ─── Replace variables using a function to avoid $/regex corruption ─
            const guestTitle = guest.title || '';
            const varsMap: Record<string, string> = {
              guestName: actualGuestName,
              guestTitle,
              title: guestTitle,
              name: guest.name || '',
              fullName: actualGuestName,
              cardNumber: actualCardNumber,
              cardNo: actualCardNumber,
              guestType: actualCardType,
              cardType: actualCardType,
              passCode: guest.passCode || 'N/A',
              event: guest.event?.name || '',
              date: formattedDate,
              eventDate: formattedDate,
              venue: vars.venue || guest.event?.venue || '',
              address: guest.event?.address || '',
              hostFamily: vars.hostFamily || guest.event?.hostFamily || '',
              person1: vars.person1 || guest.event?.person1 || '',
              person2: vars.person2 || guest.event?.person2 || '',
              time: vars.time || guest.event?.time || '',
              contact: whatsappContact || '',
            };

            const smsMessage = smsTemplateText.replace(
              /\{(guestName|guestTitle|title|name|fullName|cardNumber|cardNo|guestType|cardType|passCode|event|date|eventDate|venue|address|hostFamily|person1|person2|time|contact)\}/g,
              (match: string, key: string) => varsMap[key] ?? match
            );

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