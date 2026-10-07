// app/api/public/events/[eventId]/edit-requests/route.ts
//
// A visitor on the shared tracker can propose a correction to a guest's name
// or phone number. This route never writes to Guest: it files a
// GuestEditRequest, and the tenant applies it from their event page after
// reviewing it. That is what keeps the link (anyone holding it can call this)
// from becoming a way to rewrite the guest list.
//
// Same contract as the public contributions route: no session, the link is
// the capability, and a disabled tracker is a 404 that cannot be probed.
// At most one PENDING request exists per guest - resubmitting replaces the
// proposal rather than stacking requests for the planner to clear.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { sendPushToTenantRole } from '@/lib/push';
import { sendGuestEditRequestEmail } from '@/lib/email';

type Ctx = { params: Promise<{ eventId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, contributionsEnabled: true },
    select: { id: true, name: true, tenantId: true },
  });
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const guestId = body?.guestId ? String(body.guestId) : null;
  if (!body || !guestId) {
    return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
  }

  // Scoped to this event, so a guestId from another event cannot be targeted.
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: { id: true, name: true, phone: true },
  });
  if (!guest) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fields left out of the body keep their current value, so a caller only
  // ever proposes what it actually changed.
  const name = 'name' in body ? String(body.name ?? '').trim() : guest.name;
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (name.length > 120) {
    return NextResponse.json({ error: 'Name is too long' }, { status: 400 });
  }

  let phone: string | null = guest.phone;
  if ('phone' in body) {
    const raw = String(body.phone ?? '').trim();
    if (!raw) {
      phone = null;
    } else {
      const { normalized, isValid } = normalizePhone(raw);
      if (!isValid) {
        return NextResponse.json(
          {
            error:
              'Invalid phone number format. Must start with "+" and include country code (e.g., +255712345678).',
          },
          { status: 400 }
        );
      }
      phone = normalized;
    }
  }

  // A proposal identical to what is already stored is not something the
  // planner needs to spend a tap on.
  if (name === guest.name && phone === guest.phone) {
    return NextResponse.json({ ok: true, unchanged: true, pendingEdit: null });
  }

  const pending = await prisma.guestEditRequest.findFirst({
    where: { guestId, status: 'PENDING' },
    select: { id: true },
  });

  let created = false;
  if (pending) {
    await prisma.guestEditRequest.update({
      where: { id: pending.id },
      data: { name, phone },
    });
  } else {
    await prisma.guestEditRequest.create({
      data: { eventId, guestId, name, phone },
    });
    created = true;
  }

  // Only a first-time request notifies: a visitor correcting their own typo
  // twice should not ping the planner twice for the same guest.
  if (created) {
    try {
      const planners = await prisma.user.findMany({
        where: { tenantId: event.tenantId, role: 'CLIENT' },
        select: { id: true, name: true, email: true },
      });
      if (planners.length > 0) {
        await prisma.notification.createMany({
          data: planners.map((u) => ({
            userId: u.id,
            title: 'Guest details change requested',
            message: `${guest.name} → "${name}" · shared tracker`,
            type: 'GUEST_EDIT_REQUEST',
            link: `/client/events/${eventId}`,
          })),
        });

        // Email is a separate channel with its own failure mode: a Resend
        // outage must not stop the in-app notification, and neither must the
        // visitor's submission fail because we could not reach the mail
        // provider. Each send is caught individually for that reason.
        try {
          await Promise.all(
            planners
              .filter((u) => u.email)
              .map((u) =>
                sendGuestEditRequestEmail(u.email, {
                  plannerName: u.name,
                  guestName: guest.name,
                  currentPhone: guest.phone,
                  proposedName: name,
                  proposedPhone: phone,
                  eventName: event.name,
                  eventId,
                }).catch((err) => {
                  console.error('Guest edit request email failed for', u.email, err);
                })
              )
          );
        } catch (err) {
          console.error('Guest edit request emails failed:', err);
        }

        await sendPushToTenantRole(event.tenantId, 'CLIENT', {
          title: 'Guest details change requested',
          body: `${guest.name} — review it on the event page`,
          url: `/client/events/${eventId}`,
          type: 'GUEST_EDIT_REQUEST',
        });
      }
    } catch (err) {
      // A push outage must never eat the visitor's submission.
      console.error('Guest edit request notification failed:', err);
    }
  }

  return NextResponse.json({
    ok: true,
    pendingEdit: { name, phone, status: 'PENDING' },
  });
}
