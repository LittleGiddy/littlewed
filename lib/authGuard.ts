// lib/authGuard.ts
// Single-device session enforcement for CLIENT / STAFF accounts.
// Every auth call site should import getServerSession from here instead of
// 'next-auth'. SUPER_ADMIN accounts are exempt (multi-device allowed).
//
// A fresh sign-in rotates User.activeSessionId (see lib/auth.ts jwt callback)
// and stores the new value inside the JWT as `sid`. Here we compare the token's
// `sid` against the stored value and reject the session when they differ, which
// is exactly what happens once the same account signs in on a second device.
import { getServerSession as nextGetServerSession } from 'next-auth';
import type { NextAuthOptions, Session } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function getServerSession(
  options?: NextAuthOptions
): Promise<Session | null> {
  const session = await nextGetServerSession(
    ...(options ? [options] : ([] as []))
  );
  if (!session || !session.user || !(session.user as { id?: string }).id) return session;

  const userToken = session.user as { id?: string; role?: string };
  const role = userToken.role;
  if (role === 'SUPER_ADMIN') return session;

  const userId = userToken.id as string;
  const sid = (session as { sid?: string }).sid;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeSessionId: true },
  });

  // User was deleted → invalidate the session.
  if (!user) return null;

  // Signed in on another device → this session no longer matches.
  if (sid && user.activeSessionId && user.activeSessionId !== sid) return null;

  return session;
}