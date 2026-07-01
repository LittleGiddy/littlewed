import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const templates = await prisma.template.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(templates);
}

// POST (admin only) – create template
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { name, imageUrl } = await req.json();
  if (!name || !imageUrl) {
    return NextResponse.json({ error: 'Name and imageUrl required' }, { status: 400 });
  }
  const template = await prisma.template.create({
    data: { name, imageUrl },
  });
  return NextResponse.json(template);
}