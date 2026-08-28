import { prisma } from '@/lib/prisma';
import * as webpush from 'web-push';

export const PUSH_ENABLED =
  !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  !!process.env.VAPID_PRIVATE_KEY &&
  !!process.env.VAPID_MAILTO;

function configureWebPush() {
  if (!PUSH_ENABLED) return false;
  try {
    webpush.setVapidDetails(
      process.env.VAPID_MAILTO as string,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string
    );
    return true;
  } catch {
    return false;
  }
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  type?: string;
  sound?: boolean;
}

/**
 * Send a web push to a single user's registered devices.
 * Returns the number of devices that accepted the message.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!configureWebPush()) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body || '',
    url: payload.url || '/',
    type: payload.type || 'info',
    sound: Boolean(payload.sound),
  });

  let delivered = 0;
  const dead: string[] = [];

  for (const sub of subs) {
    const pushSub: any = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keysP256dh, auth: sub.keysAuth },
    };
    try {
      await webpush.sendNotification(pushSub, message);
      delivered++;
    } catch (err: any) {
      const code = err?.statusCode ?? 0;
      // 410 Gone / 404 Not Found → subscription no longer valid, drop it.
      if (code === 410 || code === 404) {
        dead.push(sub.id);
      }
    }
  }

  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
  }

  return delivered;
}

/**
 * Send a web push to every user in a tenant (used for check-ins and broadcasts).
 */
export async function sendPushToTenant(tenantId: string, payload: PushPayload): Promise<number> {
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true },
  });
  if (users.length === 0) return 0;

  const finalizedDelivered: number[] = [];
  for (const u of users) {
    const n = await sendPushToUser(u.id, payload);
    if (n > 0) finalizedDelivered.push(n);
  }
  return finalizedDelivered.reduce((a, b) => a + b, 0);
}

/**
 * Send a web push to users of a given role within a tenant.
 */
export async function sendPushToTenantRole(
  tenantId: string,
  role: string,
  payload: PushPayload
): Promise<number> {
  const users = await prisma.user.findMany({
    where: { tenantId, role },
    select: { id: true },
  });
  if (users.length === 0) return 0;

  const counts: number[] = [];
  for (const u of users) {
    const n = await sendPushToUser(u.id, payload);
    if (n > 0) counts.push(n);
  }
  return counts.reduce((a, b) => a + b, 0);
}

/**
 * Send a web push to all users of a given role (e.g. SUPER_ADMIN for credit requests).
 */
export async function sendPushToRole(role: string, payload: PushPayload): Promise<number> {
  const users = await prisma.user.findMany({ where: { role }, select: { id: true } });
  if (users.length === 0) return 0;

  const counts: number[] = [];
  for (const u of users) {
    const n = await sendPushToUser(u.id, payload);
    if (n > 0) counts.push(n);
  }
  return counts.reduce((a, b) => a + b, 0);
}

/**
 * Convenience: creates an in-app Notification AND sends a web push together.
 */
export async function notifyAndPush(options: {
  userId: string;
  title: string;
  message?: string;
  type?: string;
  link?: string;
  sound?: boolean;
}): Promise<number> {
  await prisma.notification.create({
    data: {
      userId: options.userId,
      title: options.title,
      message: options.message ?? null,
      type: options.type ?? 'info',
      link: options.link ?? null,
    },
  });

  return sendPushToUser(options.userId, {
    title: options.title,
    body: options.message || '',
    url: options.link || '/',
    type: options.type || 'info',
    sound: options.sound,
  });
}
