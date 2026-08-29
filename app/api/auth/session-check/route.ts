// app/api/auth/session-check/route.ts
// Used by the client to detect that the current session was invalidated
// (e.g. the same CLIENT/STAFF account signed in on another device).
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  return NextResponse.json({ valid: !!session });
}