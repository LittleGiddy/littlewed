import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { name, email, password, plan } = await req.json();
  const subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const schemaName = `tenant_${Date.now()}`;

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: { name, subdomain, schemaName, plan },
  });

  // Hash password and create admin user
  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: 'Admin',
      role: 'CLIENT',
      tenantId: tenant.id,
    },
  });

  // In production, create a new PostgreSQL schema for the tenant here
  // For SQLite (dev) we skip schema isolation

  return NextResponse.json({ success: true, tenant });
}