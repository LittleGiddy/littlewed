import { prisma } from '@/lib/prisma';

/**
 * Event-level access control for staff accounts.
 *
 * A "staff member" is a User with role 'STAFF' + tenantId. They may ONLY see
 * and mutate events that have an `EventStaffAccess` row granting THEIR account
 * access; the tenant grants/revokes those rows from the Staff page. Every other
 * role that is allowed to touch events simply uses the tenant-wide scope.
 */

type SessionUser = { id?: string; role?: string; tenantId?: string };

/**
 * Structural stand-in for a next-auth `Session`. Real `Session` objects and the
 * lean `{ user: auth }` shapes returned by `requireTenantSession` both satisfy
 * this, since every field here is optional.
 */
type SessionLike = { user?: SessionUser } | null | undefined;

const userOf = (session: SessionLike): SessionUser =>
  ((session as { user?: SessionUser } | null)?.user ?? {}) as SessionUser;

/** Roles that can manage a tenant's resources (vs. being restricted to grants). */
export const canManageTenant = (role?: string): boolean =>
  role === 'CLIENT' || role === 'SUPER_ADMIN';

/**
 * Prisma `event` `where` clause for the current caller:
 *  - STAFF  → tenant + an explicit grant row for this account
 *  - others → tenant-wide
 */
export function eventScopeWhere(session: SessionLike) {
  const user = userOf(session);
  if (user.role === 'STAFF' && user.id) {
    return {
      tenantId: user.tenantId,
      staffAccess: { some: { userId: user.id } },
    };
  }
  return { tenantId: user.tenantId };
}

/** True when the caller may access THIS event (tenant match + staff grant). */
export async function canAccessEvent(session: SessionLike, eventId: string) {
  const user = userOf(session);
  if (!user.tenantId || !user.id) return false;
  const where: {
    id: string;
    tenantId: string;
    staffAccess?: { some: { userId: string } };
  } = {
    id: eventId,
    tenantId: user.tenantId,
    ...(user.role === 'STAFF' ? { staffAccess: { some: { userId: user.id } } } : {}),
  };
  const count = await prisma.event.count({ where });
  return count > 0;
}