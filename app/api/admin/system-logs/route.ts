// app/api/admin/system-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const FAILURE_LEVELS = ['ERROR', 'WARN'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type') || '';
  const level = searchParams.get('level') || '';
  const tenantId = searchParams.get('tenant') || '';
  const cursor = searchParams.get('cursor') || '';
  const takeRaw = Number(searchParams.get('take') || 50);
  const take = Number.isFinite(takeRaw) && takeRaw > 0 && takeRaw <= 200 ? takeRaw : 50;

  try {
    const where: Prisma.SystemLogWhereInput = {};
    if (type) where.type = type;
    if (level) where.level = level;
    if (tenantId) where.tenantId = tenantId;

    const [logs, total, failure24h, summary] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, subdomain: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.systemLog.count({ where }),
      prisma.systemLog.count({
        where: { level: { in: FAILURE_LEVELS }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.systemLog.groupBy({
        by: ['type'],
        _count: { _all: true },
      }),
    ]);

    const hasMore = logs.length > take;
    const pageLogs = hasMore ? logs.slice(0, take) : logs;
    const nextCursor = hasMore ? pageLogs[pageLogs.length - 1]?.id : null;

    const summaries: Record<string, number> = {};
    for (const s of summary) summaries[s.type] = s._count._all;

    return NextResponse.json({
      logs: pageLogs,
      summaries,
      total,
      failure24h,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error('GET system-logs error:', error);
    return NextResponse.json({ error: 'Failed to load system logs' }, { status: 500 });
  }
}