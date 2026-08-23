// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, resetToken, newPassword } = await req.json();

    if (!email || !resetToken || !newPassword) {
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

    // Verify reset token
    const resetSession = await prisma.passwordResetSession.findFirst({
      where: {
        email: email,
        token: resetToken,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!resetSession) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    const user = await prisma.user.update({
      where: { email: email },
      data: { password: hashedPassword },
    });

    // Delete used reset sessions
    await prisma.passwordResetSession.deleteMany({
      where: { email: email },
    });

    // Also delete any remaining OTPs
    await prisma.passwordResetToken.deleteMany({
      where: { email: email },
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now log in.',
    });

  } catch (error) {
    console.error('[ResetPassword] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}