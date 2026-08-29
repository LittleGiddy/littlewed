import { NextRequest, NextResponse } from 'next/server';
import { checkEventStatuses } from '@/lib/jobs/check-events';

// Force this route to run fresh every time (never statically cached).
export const dynamic = 'force-dynamic';
// Give it room to run - Vercel's default function timeout can be too short
// if there are many events to process. Adjust per your plan's limits.
export const maxDuration = 60;

/**
 * Trigger this endpoint on a schedule from wherever you end up hosting:
 *
 *  - Vercel Cron: add to vercel.json (see below), Vercel calls it directly
 *    and automatically attaches the correct auth - no secret needed if you
 *    use Vercel's built-in cron (it verifies via a system header), but the
 *    manual CRON_SECRET check below still protects the route if hit from
 *    anywhere else.
 *  - Any other host: point an external scheduler (cron-job.org, GitHub
 *    Actions `schedule:` trigger, a VPS crontab, etc.) at this URL with
 *    header `Authorization: Bearer <CRON_SECRET>`.
 *
 * Recommended interval: every 15-30 minutes. The job is idempotent (guarded
 * by reminderSent / expiredNotified / status checks), so running it more
 * often than strictly necessary is harmless - it just means the 24h expiry
 * takes effect closer to the actual 24h mark instead of lagging behind.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';
    if (!isVercelCron && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await checkEventStatuses();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[cron/check-events] failed:', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}