// app/api/invitations/send-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWeddingInvitation } from '@/lib/whatsapp/index';
import { sendSMS } from '@/lib/sms/index';
import { generateAndStoreCardForGuest } from '@/lib/image-storage';
import { logSystemEvent } from '@/lib/systemLog';

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
      dailyLimit,
      eventType,
      forceChannel,
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
      include: {
        event: {
          include: {
            tenant: { select: { bypassPayment: true } },
          },
        },
      },
    });

    if (guests.length === 0) {
      return NextResponse.json({ error: 'No guests found' }, { status: 404 });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    let alreadySentCount = 0;

    // ─── Daily WhatsApp limit enforcement ───────────────────────────────
    // The WhatsApp API has a daily cap (a newly-registered number starts low,
    // e.g. 250). We count how many WhatsApp invitations were already accepted
    // today (status SENT) and stop sending WhatsApp once the configured limit
    // is reached. SMS is not affected by the WhatsApp cap.
    const limit = typeof dailyLimit === 'number' && dailyLimit > 0 ? Math.floor(dailyLimit) : null;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    let waUsed = limit
      ? await prisma.messageLog.count({
          where: {
            type: 'WHATSAPP',
            status: 'SENT',
            createdAt: { gte: startOfToday },
            guest: { event: { tenantId } },
          },
        })
      : 0;
    const waLimitReached = () => limit !== null && waUsed >= limit;

    // ─── Process in batches ────────────────────────────────────────────
    // Cache generated card URLs per card group within this request, so both
    // members of a shared DOUBLE card reuse the same composed image instead of
    // regenerating it twice.
    const cardCache = new Map<string, string>();
    const cardCacheKey = (g: any) => g.cardGroupId ? `group:${g.cardGroupId}` : `guest:${g.id}`;

    for (let i = 0; i < guests.length; i += BATCH_SIZE) {
      const batch = guests.slice(i, i + BATCH_SIZE);
      console.log(`[Batch] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(guests.length / BATCH_SIZE)}`);

      for (const guest of batch) {
        let channel: 'whatsapp' | 'sms' = guest.routingChannel === 'whatsapp' ? 'whatsapp' : 'sms';
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

          // For a shared DOUBLE card, reuse the composed image already
          // generated for a group member earlier in this request.
          const cacheKey = cardCacheKey(guest);
          if (!cardImageUrl && cardCache.has(cacheKey)) {
            cardImageUrl = cardCache.get(cacheKey)!;
          }

          if (!cardImageUrl) {
            try {
              cardImageUrl = await generateAndStoreCardForGuest(guest.id);
              if (cardImageUrl) {
                cardCache.set(cacheKey, cardImageUrl);
              }
            } catch (error) {
              console.error(`[Batch] Failed to generate card image for ${guest.name}:`, error);
              await logSystemEvent({
                tenantId,
                eventId,
                guestId: guest.id,
                type: 'card_generation',
                level: 'ERROR',
                message: `Card generation failed for ${guest.name}`,
                details: { error: error instanceof Error ? error.message : String(error) },
              });
            }
          }

          if (!cardImageUrl) {
            cardImageUrl = '';
          }

          // ─── Build invite link for the button ──────────────────────────
          const inviteLink = `https://littlewed.co.tz/invite/${guest.passCode}`;

          let result;

          // ─── Channel selection ────────────────────────────────────────
          // By default each guest is sent on their stored routing channel.
          // When `forceChannel` is given ('whatsapp' | 'sms'), the request
          // sends EVERY guest on that single channel — enabling the user to
          // independently send WhatsApp and SMS so each guest can receive
          // both messages (WhatsApp where reachable + an SMS reminder).
          const channelSelection =
            forceChannel === 'whatsapp' || forceChannel === 'sms'
              ? forceChannel
              : guest.routingChannel;
          channel = channelSelection as 'whatsapp' | 'sms';

          // ─── Once-per-channel guard (non-bypassed tenants) ─────────────
          // For tenants that are NOT in bypass-payment mode, each guest can
          // receive at most one successful invitation per channel. This stops
          // duplicate sends (and wasted spend). Failed attempts never set the
          // per-channel timestamp, so failed invitations remain retryable.
          // Bypassed tenants keep the unlimited "free" resend behaviour.
          const isBypassed = guest.event?.tenant?.bypassPayment === true;
          const alreadyOnChannel =
            channel === 'whatsapp' ? !!guest.whatsappSentAt : !!guest.smsSentAt;
          if (!isBypassed && alreadyOnChannel) {
            alreadySentCount++;
            results.push({
              guestId: guest.id,
              name: guest.name,
              success: false,
              skipped: true,
              reason: 'already_sent',
              error: `Already sent via ${channel} (one invitation per guest per channel on your plan)`,
              channel,
            });
            await new Promise(r => setTimeout(r, MESSAGE_DELAY));
            continue;
          }

          // ─── Send via appropriate channel ──────────────────────────
          if (channel === 'whatsapp') {
            console.log(`[Batch] Sending WhatsApp to ${guest.name} (${guest.phone})`);

            // ─── Daily limit reached → skip this guest (didn't receive) ──
            if (waLimitReached()) {
              console.warn(
                `[Batch] WhatsApp daily limit (${limit}) reached - skipping ${guest.name}`
              );
              await prisma.guest.update({
                where: { id: guest.id },
                data: {
                  lastSendStatus: 'SKIPPED_LIMIT',
                  lastSendError: `WhatsApp daily limit of ${limit} reached`,
                },
              }).catch(() => {});
              skippedCount++;
              results.push({
                guestId: guest.id,
                name: guest.name,
                success: false,
                skipped: true,
                reason: 'limit',
                error: `WhatsApp daily limit (${limit}) reached`,
                channel: 'whatsapp',
              });
              await new Promise(r => setTimeout(r, MESSAGE_DELAY));
              continue;
            }

            // ─── Get WhatsApp variables ──────────────────────────────────
            const vars = whatsappVariables || {};

            // ─── Replace with actual guest data ──────────────────────────
            const actualGuestName = guestFullName;
            const actualCardNumber = guest.cardNumber || vars.cardNumber || '';
            const actualCardType =
              guest.guestType === 'DOUBLE'
                ? 'Double'
                : guest.guestType === 'SINGLE'
                  ? 'Single'
                  : vars.cardType || '';

            // ─── Send WhatsApp ────────────────────────────────────────────
            // Variable values come from the user's inputs (whatsappVariables),
            // then the event data - no hardcoded fallbacks.
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
              eventType: eventType,
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

            const guestTitle = guest.title || '';
            const actualGuestName = guestFullName;
            const actualCardNumber = guest.cardNumber || vars.cardNumber || '';
            const actualCardType =
              guest.guestType === 'DOUBLE'
                ? 'Double'
                : guest.guestType === 'SINGLE'
                  ? 'Single'
                  : vars.cardType || '';

            // ─── Base template: prefer the SMS template edited by the user ──
            const smsTemplateText =
              smsTemplate ||
              message ||
              `Habari {fullName},\n\nFamilia ya {hostFamily} inakualika katika harusi ya {person1} na {person2} tarehe {date}.\n\nVenue: {venue}, saa {time}.\n\nCard No: {cardNumber} • {guestType}\n\nTafadhali onyesha kadi hii wakati wa kuingia.\nKaribu na ufurahie sherehe!\n\nAhsante.`;

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

            // A successful send that went out over the WhatsApp API (i.e.
            // NOT an SMS fallback) consumes one unit of the daily cap.
            const fellBackFromWhatsApp = !!(result.data as any)?.fellBackFromWhatsapp;
            const sentChannel = fellBackFromWhatsApp ? 'sms' : channel;
            if (!fellBackFromWhatsApp && channel === 'whatsapp') {
              waUsed++;
            }

            await prisma.guest.update({
              where: { id: guest.id },
              data: {
                invitationSentAt: new Date(),
                lastSendStatus: 'SENT',
                lastSendError: null,
                // Track per-channel so each channel's send screen can tell
                // who has already received an invitation on that channel.
                ...(sentChannel === 'whatsapp' ? { whatsappSentAt: new Date() } : {}),
                ...(sentChannel === 'sms' ? { smsSentAt: new Date() } : {}),
              },
            });

            // Always record a SENT log for WhatsApp so the daily-usage counter
            // (which counts SENT MessageLogs) is accurate even when the provider
            // returns no messageId.
            if (sentChannel === 'whatsapp' && !result.messageId) {
              result.messageId = `wa_${Date.now()}_${guest.id}`;
            }
            if (result.messageId) {
              await prisma.messageLog.create({
                data: {
                  messageId: result.messageId,
                  guestId: guest.id,
                  type: sentChannel === 'whatsapp' ? 'WHATSAPP' : 'SMS',
                  template: sentChannel === 'whatsapp' ? 'swahili_invitation' : 'custom',
                  status: 'SENT',
                  rawData: result.data || {},
                },
              });
            }
          } else {
            failCount++;
            console.error(`[Batch] Failed to send to ${guest.name}:`, result.error);
            await prisma.guest.update({
              where: { id: guest.id },
              data: {
                lastSendStatus: 'FAILED',
                lastSendError: result.error || 'Send failed',
              },
            }).catch(() => {});
            await logSystemEvent({
              tenantId,
              eventId,
              guestId: guest.id,
              type: 'send',
              level: 'ERROR',
              message: `Send failed for ${guest.name} via ${guest.routingChannel || 'unknown'}`,
              details: { channel: guest.routingChannel || 'unknown', error: result.error || undefined },
            });
          }

          results.push({
            guestId: guest.id,
            name: guest.name,
            success: result.success,
            skipped: !!(result as any).skipped,
            reason: (result as any).reason,
            error: result.error,
            channel,
          });

        } catch (error: any) {
          failCount++;
          console.error(`[Batch] Error sending to ${guest.name}:`, error.message);
          await prisma.guest.update({
            where: { id: guest.id },
            data: { lastSendStatus: 'FAILED', lastSendError: error.message || 'Unknown error' },
          }).catch(() => {});
          results.push({
            guestId: guest.id,
            name: guest.name,
            success: false,
            error: error.message || 'Unknown error',
            channel,
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
      skippedCount,
      alreadySentCount,
      waLimit: limit,
      waUsed: waUsed,
      waLimitReached: waLimitReached(),
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