// app/api/auth/verify-reset-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Find valid OTP
    const token = await prisma.passwordResetToken.findFirst({
      where: {
        email,
        otp,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
    });

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid or expired code. Please request a new one.' },
        { status: 400 }
      );
    }

    // ✅ OTP is valid - generate a temporary reset token
    // This token will be used to reset the password
    const resetToken = crypto.randomUUID();
    
    // Store the reset token (you might want a separate table for this)
    // Or we can use the existing token and mark it as used
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: {
        // We'll use the same token but store the reset token in a new field
        // Or we can create a new table for reset sessions
      },
    });

    // For simplicity, we'll delete the OTP and create a new reset session
    await prisma.passwordResetToken.delete({
      where: { id: token.id },
    });

    // Store reset token in a separate table
    await prisma.passwordResetSession.create({
      data: {
        email: email,
        token: resetToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    });

    return NextResponse.json({
      success: true,
      resetToken: resetToken,
      message: 'OTP verified successfully. You can now reset your password.',
    });

  } catch (error) {
    console.error('[VerifyResetOTP] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}