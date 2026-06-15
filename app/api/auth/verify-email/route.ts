import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { email, otp } = await req.json();
  const record = await prisma.verificationToken.findFirst({
    where: { email, otp, expiresAt: { gt: new Date() } },
  });
  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
  }
  // Optionally mark email as verified in User model later (after signup completes)
  await prisma.verificationToken.deleteMany({ where: { email } });
  return NextResponse.json({ verified: true });
}