// lib/inviteGuest.ts
// Resolves the guest behind an /invite/<token> link by passCode first, then
// the legacy signed-JWT token.
import { jwtVerify } from 'jose';
import { prisma } from './prisma';

export async function getGuestFromToken(token: string) {
  const byPassCode = await prisma.guest.findUnique({
    where: { passCode: token },
    include: { event: { include: { tenant: true } } },
  });
  if (byPassCode) return byPassCode;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    );
    const guestId = payload.guestId as string;
    if (!guestId) return null;
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      include: { event: { include: { tenant: true } } },
    });
    return guest;
  } catch {
    return null;
  }
}