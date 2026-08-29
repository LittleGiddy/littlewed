import { prisma } from '@/lib/prisma';
import { sendEventReminderEmail, sendEventExpiredEmail } from '@/lib/email';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// How long after the event date before it auto-pauses (EXPIRED).
const EXPIRE_AFTER_MS = 24 * HOUR_MS;
// How long an EXPIRED event stays resumable before being permanently ARCHIVED.
const ARCHIVE_AFTER_MS = 7 * DAY_MS;

export interface CheckEventsResult {
  promoted: number;
  remindersSent: number;
  reminderFailures: number;
  expired: number;
  expiredEmailFailures: number;
  archived: number;
  errors: string[];
}

/**
 * Runs the full event-status lifecycle sweep:
 *  1. Promote DRAFT -> ACTIVE for events starting within 24h
 *  2. Send 24h reminder emails for ACTIVE events (once)
 *  3. Expire ACTIVE events 24h after their date -> EXPIRED (pausedAt set, 7-day resume window opens)
 *  4. Permanently ARCHIVE events whose 7-day resume window has passed
 *
 * Safe to call repeatedly / concurrently-ish: every mutation is guarded by a
 * "not already done" flag (reminderSent / expiredNotified / status checks) so
 * re-running the sweep never double-sends emails or double-processes events.
 * Each event is handled independently - one failure doesn't block the rest.
 */
export async function checkEventStatuses(): Promise<CheckEventsResult> {
  const now = new Date();
  const result: CheckEventsResult = {
    promoted: 0,
    remindersSent: 0,
    reminderFailures: 0,
    expired: 0,
    expiredEmailFailures: 0,
    archived: 0,
    errors: [],
  };

  // ──────────────────────────────────────────────
  // 1️⃣ Promote DRAFT events to ACTIVE (within 24h of starting)
  // ──────────────────────────────────────────────
  try {
    const { count } = await prisma.event.updateMany({
      where: {
        status: 'DRAFT',
        date: { gte: now, lte: new Date(now.getTime() + DAY_MS) },
      },
      data: { status: 'ACTIVE' },
    });
    result.promoted = count;
  } catch (err: any) {
    result.errors.push(`promote-drafts: ${err?.message ?? String(err)}`);
  }

  // ──────────────────────────────────────────────
  // 2️⃣ Send 24‑hour reminder for ACTIVE events (once each)
  // ──────────────────────────────────────────────
  const events24h = await prisma.event.findMany({
    where: {
      status: 'ACTIVE',
      date: { gte: now, lte: new Date(now.getTime() + DAY_MS) },
      reminderSent: false,
    },
    include: { tenant: { include: { users: { select: { email: true } } } } },
  });

  for (const event of events24h) {
    try {
      const email = event.tenant?.users?.[0]?.email;
      if (email) {
        await sendEventReminderEmail(email, event.name, event.date);
      }
      // Mark as sent even if there's no email on file, so we don't retry forever.
      await prisma.event.update({
        where: { id: event.id },
        data: { reminderSent: true },
      });
      result.remindersSent++;
    } catch (err: any) {
      result.reminderFailures++;
      result.errors.push(`reminder(${event.id}): ${err?.message ?? String(err)}`);
      // Deliberately NOT marking reminderSent here - leave it false so the
      // next sweep retries this event instead of silently losing it.
    }
  }

  // ──────────────────────────────────────────────
  // 3️⃣a Expire ACTIVE events that have NEVER been resumed (24h after event
  //      date) -> pause + open a 7-day resume window.
  //
  //      Gated on `resumedAt: null` - this is the critical fix. A resumed
  //      event keeps its original (past) `date`, so without this guard it
  //      would match this query again on the very next cron tick (its
  //      `expiredNotified` was just reset to false by the resume route),
  //      re-pausing it within minutes instead of giving it the promised
  //      7 active days.
  // ──────────────────────────────────────────────
  const expiredEvents = await prisma.event.findMany({
    where: {
      status: 'ACTIVE',
      resumedAt: null,
      date: { lt: new Date(now.getTime() - EXPIRE_AFTER_MS) },
      expiredNotified: false,
    },
    include: { tenant: { include: { users: { select: { email: true } } } } },
  });

  for (const event of expiredEvents) {
    try {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          status: 'EXPIRED',
          pausedAt: now,
          expiresAt: new Date(now.getTime() + ARCHIVE_AFTER_MS),
          expiredNotified: true,
        },
      });
      result.expired++;

      try {
        const email = event.tenant?.users?.[0]?.email;
        if (email) {
          await sendEventExpiredEmail(email, event.name);
        }
      } catch (emailErr: any) {
        // Status change already succeeded - an email failure shouldn't be
        // reported as an expiry failure, just logged separately.
        result.expiredEmailFailures++;
        result.errors.push(`expired-email(${event.id}): ${emailErr?.message ?? String(emailErr)}`);
      }
    } catch (err: any) {
      result.errors.push(`expire(${event.id}): ${err?.message ?? String(err)}`);
    }
  }

  // ──────────────────────────────────────────────
  // 3️⃣b Once-resumed events get exactly one grace period: 7 days after
  //      `resumedAt`, archive directly (no second pause/resume cycle).
  //      This needs no extra flag - the moment status flips to ARCHIVED it
  //      stops matching `status: 'ACTIVE'`, so re-running this sweep is
  //      naturally idempotent.
  // ──────────────────────────────────────────────
  try {
    const { count } = await prisma.event.updateMany({
      where: {
        status: 'ACTIVE',
        resumedAt: { lt: new Date(now.getTime() - ARCHIVE_AFTER_MS) },
      },
      data: { status: 'ARCHIVED' },
    });
    result.archived += count;
  } catch (err: any) {
    result.errors.push(`archive-after-resume: ${err?.message ?? String(err)}`);
  }

  // ──────────────────────────────────────────────
  // 4️⃣ Permanently archive EXPIRED events whose 7-day resume window has
  //     passed without being resumed.
  // ──────────────────────────────────────────────
  try {
    const { count } = await prisma.event.updateMany({
      where: { status: 'EXPIRED', expiresAt: { lt: now } },
      data: { status: 'ARCHIVED' },
    });
    result.archived += count;
  } catch (err: any) {
    result.errors.push(`archive: ${err?.message ?? String(err)}`);
  }

  return result;
}