import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { email, otp, newPassword } = await req.json();

  if (!email || !otp || !newPassword) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  // Find valid OTP
  const token = await prisma.passwordResetToken.findFirst({
    where: {
      email,
      otp,
      expiresAt: { gt: new Date() },
    },
  });

  if (!token) {
    return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update user password
  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  // Delete used token
  await prisma.passwordResetToken.deleteMany({ where: { email } });

  return NextResponse.json({ message: 'Password reset successful' });
}