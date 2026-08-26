// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp, newPassword } = body;

    console.log('[ResetPassword] Request received:', { email });

    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Find valid OTP
    const token = await prisma.passwordResetToken.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        otp: otp,
        expiresAt: { gt: new Date() },
      },
    });

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // ✅ Update user password (works for both Google-only and existing password users)
    await prisma.user.update({
      where: { email: email.toLowerCase().trim() },
      data: { password: hashedPassword },
    });

    // Delete used token
    await prisma.passwordResetToken.deleteMany({
      where: { email: email.toLowerCase().trim() },
    });

    console.log(`[ResetPassword] Password ${await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } }).then(u => u?.password ? 'updated' : 'set')} for: ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Password set successfully. You can now sign in with email and password.',
    });

  } catch (error) {
    console.error('[ResetPassword] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}