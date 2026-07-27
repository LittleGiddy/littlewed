import { Queue, Worker } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { sendEventReminderEmail, sendEventExpiredEmail } from '@/lib/email';

const eventQueue = new Queue('event-status', { connection: { host: 'localhost', port: 6379 } });

// ── Add a recurring job ──
await eventQueue.add(
  'check-events',
  {},
  {
    repeat: { pattern: '0 */6 * * *' }, // every 6 hours
    jobId: 'check-events',
  }
);

// ── Worker ──
const worker = new Worker(
  'event-status',
  async (job) => {
    const now = new Date();
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // 1️⃣ Events happening in the next 24 hours
    const events24h = await prisma.event.findMany({
      where: {
        status: { in: ['ACTIVE', 'DRAFT'] },
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

    // 2️⃣ Events that have expired (1 hour after event date)
    const expiredEvents = await prisma.event.findMany({
      where: {
        status: 'ACTIVE',
        date: {
          lt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago or more
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
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
      const email = event.tenant?.users?.[0]?.email;
      if (email) {
        await sendEventExpiredEmail(email, event.name);
      }
    }

    // 3️⃣ Permanently archive events that are 7+ days expired
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