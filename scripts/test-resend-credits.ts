/**
 * Dev-console smoke test for the resend-credit math.
 *
 * It connects to the LOCAL DEV database (DATABASE_URL from .env), creates
 * throw-away tenants, exercises the real `checkAndChargeResendCredits` helper
 * (lib/credits.ts) through every branch the send-sms / send-whatsapp /
 * send-batch routes use, then cleans up after itself.
 *
 * Run from the project root:
 *   npx tsx scripts/test-resend-credits.ts
 *
 * Exit code 0 = all assertions passed, 1 = failures.
 */

import { prisma } from '../lib/prisma';
import {
  checkAndChargeResendCredits,
  isCreditsDisabled,
  effectiveCredits,
  CREDITS_DISABLED_MESSAGE,
  RESEND_COST_PER_INVITATION,
  type ResendCreditCheck,
} from '../lib/credits';

// Node 21.7+ can load .env files natively. Prisma would load `.env` anyway,
// but loading it explicitly keeps the script independent of cwd assumptions.
try {
  process.loadEnvFile('.env');
} catch {
  /* .env optional (Prisma auto-loads it) */
}
try {
  process.loadEnvFile('.env.local');
} catch {
  /* .env.local optional */
}

let passes = 0;
let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passes += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? `  |  ${detail}` : ''}`);
  }
}

const EVENT_ID = 'resend-credit-test'; // UsageRecord.eventId has no FK relation; a dummy id is fine
const RESEND_SUFFIX = '_resend';

/**
 * Faithful reproduction of the routes' decision for a `resend: true` action.
 * Branches mirror app/api/invitations/send-sms & send-whatsapp & send-batch:
 *
 *   bypassed tenant            -> free, no helper, no restriction
 *   not yet delivered (retry)  -> free, no helper (failed invites are free)
 *   standard + already-delivered -> checkAndChargeResendCredits(...)
 */
async function decideResend(opts: {
  tenantId: string;
  channel: 'whatsapp' | 'sms';
  count: number;
  bypassPayment: boolean;
  alreadyDelivered: boolean;
}): Promise<{ decision: 'free' | 'charged'; check?: ResendCreditCheck }> {
  const { tenantId, channel, count, bypassPayment, alreadyDelivered } = opts;
  if (bypassPayment || !alreadyDelivered) {
    return { decision: 'free' };
  }
  const check = await checkAndChargeResendCredits(tenantId, EVENT_ID, channel, count);
  return { decision: 'charged', check };
}

async function usageFor(tenantId: string): Promise<{ count: number; rows: { channel: string; cost: number }[] }> {
  const rows = await prisma.usageRecord.findMany({ where: { tenantId } });
  return {
    count: rows.length,
    rows: rows
      .filter((r) => r.channel.endsWith(RESEND_SUFFIX))
      .map((r) => ({ channel: r.channel, cost: r.cost })),
  };
}

async function creditBalance(tenantId: string): Promise<number> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { credits: true } });
  return t?.credits ?? -1;
}

async function main() {
  console.log('Resend-credit smoke test');
  console.log('------------------------');

  // ── 0. Pure (no-DB) contract checks ────────────────────────────────
  console.log('[0] Pure constants/helpers');
  check('RESEND_COST_PER_INVITATION === 1', RESEND_COST_PER_INVITATION === 1, `got ${RESEND_COST_PER_INVITATION}`);
  check('isCreditsDisabled(false flag) is true', isCreditsDisabled({ credits: null, creditsEnabled: false }) === true);
  check('isCreditsDisabled(null) is false', isCreditsDisabled(null) === false);
  check('effectiveCredits ignores value when disabled', effectiveCredits({ creditsEnabled: false, credits: 50 }) === 0);
  check('effectiveCredits uses balance otherwise', effectiveCredits({ credits: 7 }) === 7);

  // ── Scratch tenants ────────────────────────────────────────────────
  const created: string[] = [];
  const mk = async (data: { bypassPayment?: boolean; creditsEnabled?: boolean; credits?: number }) => {
    const subdomain = `resend-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const t = await prisma.tenant.create({
      data: { name: 'Resend Credit Test', subdomain, ...data },
    });
    created.push(t.id);
    return t.id;
  };

  const t1 = await mk({ bypassPayment: true, credits: 0 }); // bypass, no credits
  const t2 = await mk({ bypassPayment: true, credits: 0, creditsEnabled: false }); // bypass + kill-switch
  const t3 = await mk({ credits: 5 }); // standard, enough for a 2-count resend
  const t4 = await mk({ credits: 1 }); // standard, low balance
  const t5 = await mk({ credits: 3, creditsEnabled: false }); // standard + kill-switch
  const t6 = await mk({ credits: 0 }); // standard, empty

  try {
    // ── 1. Bypassed tenant: free + unlimited ─────────────────────────
    console.log('[1] Bypassed tenant (bypassPayment=true)');
    for (const channel of ['whatsapp', 'sms'] as const) {
      const r = await decideResend({ tenantId: t1, channel, count: 3, bypassPayment: true, alreadyDelivered: true });
      check(`bypass ${channel} resend x3 allowed for free`, r.decision === 'free');
    }
    check('bypass credits untouched', (await creditBalance(t1)) === 0);
    check('bypass records no usage', (await usageFor(t1)).count === 0);

    // ── 2. Bypassed tenant + credits kill-switch: still free ─────────
    console.log('[2] Bypassed tenant with creditsEnabled=false');
    const r2 = await decideResend({ tenantId: t2, channel: 'sms', count: 1, bypassPayment: true, alreadyDelivered: true });
    check('bypass + kill-switch resend allowed for free', r2.decision === 'free');
    check('kill-switch bypass credits untouched', (await creditBalance(t2)) === 0);
    check('kill-switch bypass records no usage', (await usageFor(t2)).count === 0);

    // ── 3. Standard tenant: charged 1 credit per resend ──────────────
    console.log('[3] Standard tenant, healthy balance (5)');
    const r3 = await decideResend({ tenantId: t3, channel: 'whatsapp', count: 2, bypassPayment: false, alreadyDelivered: true });
    check('charged decision', r3.decision === 'charged');
    check('allowed = true', r3.check?.allowed === true);
    check('creditsNeeded = 2 x cost', r3.check?.creditsNeeded === 2 * RESEND_COST_PER_INVITATION, JSON.stringify(r3.check));
    check('costPerResend exposed = 1', r3.check?.costPerResend === RESEND_COST_PER_INVITATION);
    check('creditsAvailable = 5 - 2 = 3', r3.check?.creditsAvailable === 3, JSON.stringify(r3.check));
    check('balance decremented to 3', (await creditBalance(t3)) === 3, `got ${await creditBalance(t3)}`);
    const u3 = await usageFor(t3);
    check('2 usage rows', u3.count === 2);
    check('rows are whatsapp_resend, cost 1', u3.rows.every((x) => x.channel === 'whatsapp_resend' && x.cost === 1));

    // ── 4. Standard tenant: insufficient balance ─────────────────────
    console.log('[4] Standard tenant, short balance (1, resends 2)');
    const r4 = await decideResend({ tenantId: t4, channel: 'sms', count: 2, bypassPayment: false, alreadyDelivered: true });
    check('blocked', r4.check?.allowed === false);
    check('creditsAvailable = 1', r4.check?.creditsAvailable === 1, JSON.stringify(r4.check));
    check('creditsNeeded = 2', r4.check?.creditsNeeded === 2);
    check('error mentions insufficient credits', (r4.check?.error ?? '').toLowerCase().includes('insufficient'), r4.check?.error);
    check('balance unchanged', (await creditBalance(t4)) === 1);
    check('no usage recorded', (await usageFor(t4)).count === 0);

    // ── 5. Standard tenant: credits kill-switch ──────────────────────
    console.log('[5] Standard tenant with creditsEnabled=false');
    const r5 = await decideResend({ tenantId: t5, channel: 'sms', count: 1, bypassPayment: false, alreadyDelivered: true });
    check('blocked even with balance', r5.check?.allowed === false);
    check('creditsAvailable treated as 0', r5.check?.creditsAvailable === 0, JSON.stringify(r5.check));
    check('credentials-disabled message', r5.check?.error === CREDITS_DISABLED_MESSAGE, r5.check?.error);
    check('balance untouched', (await creditBalance(t5)) === 3);
    check('no usage recorded', (await usageFor(t5)).count === 0);

    // ── 6. Standard tenant: zero balance ─────────────────────────────
    console.log('[6] Standard tenant, zero balance');
    const r6 = await decideResend({ tenantId: t6, channel: 'whatsapp', count: 1, bypassPayment: false, alreadyDelivered: true });
    check('blocked', r6.check?.allowed === false);
    check('creditsAvailable = 0', r6.check?.creditsAvailable === 0);

    // ── 7. Failed retry (never delivered): free for standard tenants ─
    console.log('[7] Retry of a failed invite (alreadyDelivered=false)');
    const r7 = await decideResend({ tenantId: t6, channel: 'whatsapp', count: 1, bypassPayment: false, alreadyDelivered: false });
    check('free (no charge for failed retry)', r7.decision === 'free');
    check('no usage recorded', (await usageFor(t6)).count === 0);

    // ── 8. Zero-count is a no-op ─────────────────────────────────────
    console.log('[8] Zero-count resend');
    const r8 = await decideResend({ tenantId: t3, channel: 'whatsapp', count: 0, bypassPayment: false, alreadyDelivered: true });
    check('allowed', r8.check?.allowed === true);
    check('no credits needed', r8.check?.creditsNeeded === 0);
    check('balance unchanged from 3', (await creditBalance(t3)) === 3);
    check('no usage added', (await usageFor(t3)).count === 2); // still just the earlier 2
  } finally {
    console.log('------------------------');
    console.log(`Cleanup: deleting ${created.length} scratch tenant(s) + their usage records`);
    await prisma.usageRecord.deleteMany({ where: { tenantId: { in: created } } });
    await prisma.tenant.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  }

  const verdict = failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`;
  console.log(`Result: ${verdict} (${passes} passed, ${failures} failed)`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exitCode = 1;
  prisma.$disconnect().finally(() => process.exit(1));
});