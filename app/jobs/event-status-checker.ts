import { Queue, Worker } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { sendEventReminderEmail, sendEventExpiredEmail } from '@/lib/email';

// ── Queue setup (reuse your existing connection) ──
const eventQueue = new Queue('event-status', {
  connection: { host: 'localhost', port: 6379 },
});

// ── Add recurring job (every 6 hours) ──
await eventQueue.add(
  'check-events',
  {},
  {
    repeat: { pattern: '0 */6 * * *' },
    jobId: 'check-events',
  }
);

// ── Worker ──
const worker = new Worker(
  'event-status',
  async (job) => {
    const now = new Date();
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // ──────────────────────────────────────────────
    // 1️⃣ Promote DRAFT events to ACTIVE (24h before)
    // ──────────────────────────────────────────────
    const draftsToPublish = await prisma.event.findMany({
      where: {
        status: 'DRAFT',
        date: {
          gte: now,
          lte: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
        reminderSent: false, // only if we haven't already sent the reminder (optional)
      },
    });

    for (const draft of draftsToPublish) {
      // Promote to ACTIVE
      await prisma.event.update({
        where: { id: draft.id },
        data: { status: 'ACTIVE' },
      });
      // The reminder email will be sent in the next step (step 2)
    }

    // ──────────────────────────────────────────────
    // 2️⃣ Send 24‑hour reminder (for ACTIVE events)
    // ──────────────────────────────────────────────
    const events24h = await prisma.event.findMany({
      where: {
        status: 'ACTIVE', // now only ACTIVE events are considered
        date: {
          gte: now,
          lte: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
        reminderSent: false,
      },
      include: { tenant: { include: { users: { select: { email: true } } } } },
    });

    for (const event of events24h) {
      const email = event.tenant?.users?.[0]?.email;
      if (email) {
        await sendEventReminderEmail(email, event.name, event.date);
        await prisma.event.update({
          where: { id: event.id },
          data: { reminderSent: true },
        });
      }
    }

    // ──────────────────────────────────────────────
    // 3️⃣ Expire ACTIVE events (1 hour after event date)
    // ──────────────────────────────────────────────
    const expiredEvents = await prisma.event.findMany({
      where: {
        status: 'ACTIVE',
        date: {
          lt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
        },
        expiredNotified: false,
      },
      include: { tenant: { include: { users: { select: { email: true } } } } },
    });

    for (const event of expiredEvents) {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          status: 'EXPIRED',
          pausedAt: now,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          expiredNotified: true,
        },
      });
      const email = event.tenant?.users?.[0]?.email;
      if (email) {
        await sendEventExpiredEmail(email, event.name);
      }
    }

    // ──────────────────────────────────────────────
    // 4️⃣ Archive permanently (7 days after expiry)
    // ──────────────────────────────────────────────
    await prisma.event.updateMany({
      where: {
        status: 'EXPIRED',
        expiresAt: { lt: now },
      },
      data: { status: 'ARCHIVED' },
    });
  },
  { connection: { host: 'localhost', port: 6379 } }
);