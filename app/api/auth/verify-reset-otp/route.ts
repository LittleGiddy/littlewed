// app/api/auth/verify-reset-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp } = body;

    console.log('[VerifyResetOTP] Request received:', { email, otp });

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Find valid OTP
    const token = await prisma.passwordResetToken.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        otp: otp,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
    });

    if (!token) {
      console.log('[VerifyResetOTP] Invalid or expired OTP for:', email);
      return NextResponse.json(
        { error: 'Invalid or expired code. Please request a new one.' },
        { status: 400 }
      );
    }

    // ✅ OTP is valid - generate a temporary reset token
    const resetToken = randomUUID();
    
    // Delete the used OTP
    await prisma.passwordResetToken.delete({
      where: { id: token.id },
    });

    // Store reset token in the session table
    await prisma.passwordResetSession.create({
      data: {
        email: email.toLowerCase().trim(),
        token: resetToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    });

    console.log('[VerifyResetOTP] OTP verified successfully for:', email);

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