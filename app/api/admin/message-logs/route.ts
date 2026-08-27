import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const FAILURE_STATUSES = ['FAILED', 'REJECTED'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') || '';
  const channel = searchParams.get('channel') || '';
  const tenantId = searchParams.get('tenant') || '';
  const cursor = searchParams.get('cursor') || '';
  const takeRaw = Number(searchParams.get('take') || 50);
  const take = Number.isFinite(takeRaw) && takeRaw > 0 && takeRaw <= 200 ? takeRaw : 50;

  try {
    const where: any = {};
    if (status) where.status = status;
    if (channel) where.type = channel.toUpperCase();
    if (tenantId) where.guest = { event: { tenantId } };

    const [logs, total, failure24h, summary] = await Promise.all([
      prisma.messageLog.findMany({
        where,
        include: {
          guest: {
            select: {
              id: true,
              name: true,
              phone: true,
              event: {
                select: {
                  id: true,
                  name: true,
                  tenant: { select: { id: true, name: true, subdomain: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.messageLog.count({ where }),
      prisma.messageLog.count({
        where: { status: { in: FAILURE_STATUSES }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.messageLog.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const hasMore = logs.length > take;
    const pageLogs = hasMore ? logs.slice(0, take) : logs;
    const nextCursor = hasMore ? pageLogs[pageLogs.length - 1]?.id : null;

    const counts: Record<string, number> = {};
    const summaryMap: Record<string, number> = {};
    for (const s of summary) {
      summaryMap[s.status] = s._count._all;
      if (FAILURE_STATUSES.includes(s.status)) counts[s.status] = s._count._all;
    }

    return NextResponse.json({
      logs: pageLogs,
      summary: summaryMap,
      total,
      failure24h,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error('GET message-logs error:', error);
    return NextResponse.json({ error: 'Failed to load message logs' }, { status: 500 });
  }
}
