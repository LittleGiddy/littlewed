// lib/systemLog.ts
// Persistent technical/system logging so the super admin can monitor card
// generation failures, send failures and other technical events across all
// tenants. Used for events that never produce a MessageLog (e.g. card image
// render errors, provider failures).

import { prisma } from '@/lib/prisma';

interface SystemLogInput {
  tenantId?: string | null;
  eventId?: string | null;
  guestId?: string | null;
  type: string;
  level?: 'ERROR' | 'WARN' | 'INFO';
  message: string;
  details?: unknown;
}

export async function logSystemEvent(input: SystemLogInput): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        tenantId: input.tenantId || null,
        eventId: input.eventId || null,
        guestId: input.guestId || null,
        type: input.type,
        level: input.level || 'ERROR',
        message: input.message.slice(0, 2000),
        details: input.details === undefined ? undefined : (input.details as object),
      },
    });
  } catch (error) {
    console.error('Failed to write system log:', error);
  }
}