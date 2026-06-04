import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { business_name, email, password, plan } = await req.json();
  if (!business_name || !email || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
  }

  const subdomain = business_name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const hashed = await bcrypt.hash(password, 10);

  const tenant = await prisma.tenant.create({
  data: {
    name: business_name,
    subdomain,
    plan: 'BASIC',        // unused but keep
    subscriptionStatus: 'active',
    maxGuests: 200,
    creditBalance: 0,
  },
});

  await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: 'Admin',
      role: 'CLIENT',
      tenantId: tenant.id,
    },
  });

  return NextResponse.json({ success: true, tenantId: tenant.id });
}