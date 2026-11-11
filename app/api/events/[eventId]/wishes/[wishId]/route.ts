import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ─── DELETE a single guest wish / comment ──────────────────────────────
// Wishes are shown publicly on the invitee page, so a tenant needs a way to
// remove spam or abusive messages. Scoped to the owning tenant's event.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; wishId: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !role || !['CLIENT', 'SUPER_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as { tenantId?: string }).tenantId;
  if (role !== 'SUPER_ADMIN' && !tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { eventId, wishId } = await params;

  const wish = await prisma.guestWish.findFirst({
    where:
      role === 'SUPER_ADMIN'
        ? { id: wishId, eventId }
        : { id: wishId, eventId, event: { tenantId } },
    select: { id: true },
  });

  if (!wish) {
    return NextResponse.json({ error: 'Wish not found' }, { status: 404 });
  }

  await prisma.guestWish.delete({ where: { id: wish.id } });

  return NextResponse.json({ success: true });
}
