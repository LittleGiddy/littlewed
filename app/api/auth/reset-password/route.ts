// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, resetToken, newPassword } = body;

    console.log('[ResetPassword] Request received:', { 
      email, 
      hasResetToken: !!resetToken,
      hasNewPassword: !!newPassword 
    });

    // ✅ Check all required fields
    if (!email || !resetToken || !newPassword) {
      console.log('[ResetPassword] Missing fields:', { 
        hasEmail: !!email, 
        hasResetToken: !!resetToken, 
        hasNewPassword: !!newPassword 
      });
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
        email: email.toLowerCase().trim(),
        token: resetToken,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!resetSession) {
      console.log('[ResetPassword] Invalid or expired reset token for:', email);
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await prisma.user.update({
      where: { email: email.toLowerCase().trim() },
      data: { password: hashedPassword },
    });

    // Delete used reset sessions
    await prisma.passwordResetSession.deleteMany({
      where: { email: email.toLowerCase().trim() },
    });

    // Also delete any remaining OTPs
    await prisma.passwordResetToken.deleteMany({
      where: { email: email.toLowerCase().trim() },
    });

    console.log('[ResetPassword] Password reset successful for:', email);

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