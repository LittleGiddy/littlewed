# Tenant-Side System Flow

Controls, limits, and credit billing for the **client (tenant) side** of LittleWed:

1. Creating events
2. Credits usage (buy / request / spend / refund)
3. Sending messages (invitations, reminders, thank-you cards)

Reference file paths are included so each rule can be verified against the code.

---

## 1. Tenant-level configuration controls

Configurable per tenant by the admin; these shape every limit below.

| Setting | Default | Effect |
|---|---|---|
| `creditsEnabled` | `true` | Kill-switch. When `false`, effective credits = **0** and all credit-funded actions are blocked (guest add/import, reminders, thank-you cards). Applies even in bypass mode. |
| `bypassPayment` | `false` | Free/test mode. Skips credit checks and credit deductions (guests, reminders — unlimited, thank-you card). |
| `credits` | `0` | Current credit balance. |
| `maxGuests` | `200` | ⚠️ **Not enforced** — set/edited only (see §5 finding 1). |
| `subscriptionStatus` | `inactive` | Set `active` on signup / subscribe / admin status. ⚠️ Not read by any credit-funded API route. |
| `testMode` / `simpleEventMode` | `false` | Stored, not used to gate any of the flows below. |
| `whatsappTemplate` / `whatsappAccount` | `event_invitation` / `TANZANIATIP` | WhatsApp invitation template config. |

Sources: `prisma/schema.prisma`, `app/api/admin/tenants/[id]/settings/route.ts`, `lib/credits.ts`.

---

## 2. Creating events

`POST /api/events/create-with-credits` (`app/api/events/create-with-credits/route.ts`)

- Roles permitted: **CLIENT**, SUPER_ADMIN.
- Required input: `name`, `venue`, `date`, and `guestCount >= 1`.
- **No credit charged at creation.** Credits are billed later: **1 credit per guest** when the guest is added or imported.
- `total_budget = guestCount * 500` (TZS) is stored as metadata only (`COST_PER_GUEST = 500`); set to `0` when `bypassPayment`.
- Event is created with `status: DRAFT`.
- **No limit on the number of events a tenant can create.**

Event update (`app/api/events/[eventId]/route.ts` PUT)
- Name/venue/address/date editable **until the first guest checks in** — after that the date is locked (409).

Event delete (`same file` DELETE)
- Refunds **1 credit per deleted guest that was never sent an invitation** (`invitationSentAt == null`), recorded as `guest_refund`, cost `-1`. No refund when `bypassPayment` (nothing was charged). Source: `lib/credits.ts`.

Event lifecycle — automated sweep (`lib/jobs/check-events.ts`, cron)
- `DRAFT → ACTIVE` automatically when the event starts within 24h.
- A **24h reminder** is sent to the tenant's user **by email, once** (`reminderSent` flag). Not SMS, not credits.
- `ACTIVE` (never resumed) → `EXPIRED` 24h after the event date; a 7-day resume window opens (`expiresAt`).
- `EXPIRED` → resumable via `app/api/events/[eventId]/resume/route.ts` for 7 days; resume grants one extra 7-day active window, then `ARCHIVED`.
- `EXPIRED` past window → `ARCHIVED`. No credits involved.

---

## 3. Credits usage

### 3.1 Earning credits

**Self-purchase via ClickPesa** — `app/api/events/prepare/route.ts` + `app/api/webhooks/stripe/clickpesa/route.ts`
- Rate: **`CREDIT_COST = 300 TZS per credit`**; minimum 1 credit (300 TZS).
- `credits = floor(amount / 300)`.
- Flow: prepare → click to pay → `Transaction` (PENDING) → webhook marks `COMPLETED` and adds credits to `Tenant.credits`. Amounts < 300 TZS are marked `FAILED`, no credits added.

**Admin-granted credits**
- `app/api/admin/tenants/[id]/credit/route.ts`, `app/api/admin/tenants/[id]/event-credits/route.ts`, `app/api/admin/credits/grant/route.ts` — all `credits += amount`.
- Stripe webhook also increments credits (`app/api/webhooks/stripe/route.ts`).

**Credit requests** — `app/api/credits/request/route.ts`
- Rate: **`CREDIT_COST_TZS = 500 per credit`** — ⚠️ **mismatch** vs the 300 TZS/credit ClickPesa price (a requested credit is valued higher).
- Rules: min 1 credit; **only one pending request per tenant** at a time; admin + super-admin notified.
- `CreditRequest.amountTZS = requestedCredits * 500`.

### 3.2 Customer-facing credit spend

| Action | Cost | Where |
|---|---|---|
| Add a guest (single) | **1 credit** | `app/api/guests/route.ts` |
| Import guests | **1 credit each** (deducted for `result.count`) | `app/api/guests/import/route.ts` |
| Send reminder SMS | First reminder per guest **free**; each subsequent reminder **50 credits** | `app/api/events/[eventId]/send-reminders/route.ts` |
| Send thank-you card | **300 credits** per WhatsApp guest | `app/api/events/[eventId]/thanks-card/send/route.ts` |
| Send invitations (batch / single) | **FREE — no credit check** | §4 |
| Event check-in | Free | `app/api/check-in/route.ts` |

All deductions are skipped when `bypassPayment` and are always blocked when `creditsEnabled === false`. Every deduction writes a `UsageRecord` (`channel`, `cost`) so the ledger is auditable — except invitation sends and check-in, which never create usage records.

Insufficient-balance behavior: guest add/import, reminders (2nd+), and thank-you cards return a `400` with `needsCredits` / `creditsDisabled` / available balance — the request is rejected before sending.

### 3.3 Bypass / disabled edge cases

- `bypassPayment = true` → no checks, no deductions, reminders unlimited, thank-you cards free. (`guests/count` API returns `credits: -1` as the signal.)
- `creditsEnabled = false` → behaves as 0 credits in every route (`lib/credits.ts` `effectiveCredits()`); pending disabled-state rejections carry the admin message.

---

## 4. Sending messages

### 4.1 Invitations (free)

| Route | Channel | Role | Limits / behavior |
|---|---|---|---|
| `app/api/invitations/send-batch/route.ts` | WhatsApp template | CLIENT | Sends in batches: `BATCH_SIZE = 5`, `BATCH_DELAY = 2000ms`, `MESSAGE_DELAY = 500ms`. **No credit check.** |
| `app/api/invitations/send-sms/route.ts` | SMS (NexSMS) | — | Single guest. Requires phone. **No credit check.** Marks `invitationSentAt`. |
| `app/api/invitations/send-whatsapp/route.ts` | WhatsApp | CLIENT | Requires `routingChannel === 'whatsapp'`. **No credit check.** |
| `app/api/invitations/broadcast/route.ts` | SMS | CLIENT, SUPER_ADMIN | Custom message to selected guests, 300ms delay, appends `(Card: NNNNN)`. `type: 'thanks'` sets `thanksSentAt`. **No credit check, no usage record.** |

**Finding:** sending invitations is **not billed** in credits at the route level. If "1 credit per invitation" is intended, it is not implemented — only guest-creation is charged. Optionally also note the dedicated thanks-card route should be used for thank-you sends; `broadcast` with `type: 'thanks'` bypasses the WhatsApp-only and 300-credit logic entirely.

### 4.2 Reminders — SMS (`app/api/events/[eventId]/send-reminders/route.ts`)

- Role: **CLIENT only**.
- **Once per event**: `manualReminderSent` lock blocks re-send for non-bypassed tenants (bypassed = unlimited).
- Cost: first reminder per guest free; subsequent reminders **50 credits each**.
- Credits disabled → blocked. Insufficient credits → `400` before sending.
- Deducts `totalCost`, increments `reminderCount`, sets `manualReminderSent = true` when at least one SMS succeeds.
- SMS always sent via NexSMS (`lib/sms/index.ts`); personalization tokens `{name}`, `{event}` supported.

### 4.3 Thank-you cards — WhatsApp only (`app/api/events/[eventId]/thanks-card/send/route.ts`)

- **WhatsApp-only.** Targets = checked-in guests with `routingChannel === 'whatsapp'`, a phone number, and (bypassed or `thanksSentAt == null` — i.e. once per guest).
- Cost: **`THANKS_COST_PER_MESSAGE = 300` credits** per WhatsApp guest.
- Credits disabled → blocked; insufficient balance → rejected; deducts `totalCost` (skipped when bypassed). Sets `thanksSentAt`; push notification to tenant CLIENT.

### 4.4 SMS transport behavior (`lib/sms/index.ts`)

- Uses `NEXT_SMS_API_KEY`, `NEXT_SMS_SENDER_ID` (default `MAHIRI LTD`).
- **If `NEXT_SMS_API_KEY` is not set, sends are simulated** — the message is only logged and returns `success: true`. Simulated "successes" still count: reminders will mark `manualReminderSent` and thanks-card logic counts them as sent. (Credits are only deducted in those flows where a price exists.)
- Note: invite sends are nailed to SMS/WhatsApp regardless of tenant `testMode`.

### 4.5 Check-in (`app/api/check-in/route.ts`)

- Guests can only check in after `checkInStartTime` (403 with the available time otherwise).
- `guestType` enforcement: SINGLE max 1 check-in, DOUBLE max 2 (`checkInCount`). No credits involved.

---

## 5. Audit findings (controls that may not be "properly configured")

1. **`maxGuests` (default 200) is not enforced.** Guest add and import both state "credits are now the only limit" — a tenant can add/import as many guests as credits allow. `maxGuests` is only set at signup (200), editable in admin settings, and used to scale report charts — never as a hard cap on guest add/import. The UI "limit" bar in the event page is `event.guestCount` (the count declared when the event was created), not `tenant.maxGuests` (`app/api/events/[eventId]/guests/count/route.ts`).
2. **Invitation sends are free.** `send-batch`, `send-sms`, `send-whatsapp`, and `broadcast` perform no credit check and write no `UsageRecord`. Only guest-creation consumes credits in the "invite" flow.
3. **Credit pricing mismatch:** ClickPesa self-purchase = **300 TZS/credit** (`events/prepare/route.ts`) vs credit-request pricing = **500 TZS/credit** (`credits/request/route.ts`, `CreditRequest.amountTZS`).
4. **`subscriptionStatus` does not gate anything.** It is set to `active` at signup/subscribe/admin-status but no client API route checks it before allowing events/credits/sends. The only real kill-switches are `creditsEnabled` (and per-route `bypassPayment`).
5. **`testMode` / `simpleEventMode` are inert** with respect to these flows (used only as stored flags).
6. **Reminder cost asymmetry:** "first reminder free, subsequent 50" is per-guest (`reminderCount`), but the send is once-per-event (`manualReminderSent`). So for non-bypassed tenants the only way a guest accumulates a 50-credit reminder is a previous batch that included them — otherwise the second call is blocked at the event level.
7. **Simulated SMS fallback:** without `NEXT_SMS_API_KEY`, all SMS "succeed" silently (log-only); downstream flags (`manualReminderSent`, `thanksSentAt`) and (where applicable) credit deductions still happen.

---

## Summary of where credits are checked vs not

| Flow | Role | Credit check | Deduction | Blocked when credits disabled? |
|---|---|---|---|---|
| Create event | CLIENT | no (free) | no | no |
| Add guest | CLIENT | yes (≥1) | 1 | yes |
| Import guests | CLIENT | yes (≥ count) | 1 each | yes |
| Send invitation (batch/sms/whatsapp/broadcast) | CLIENT/(+) | **no** | no | no |
| Send reminder SMS | CLIENT | yes (after free-first) | 50/guest (2nd+) | yes |
| Send thank-you card | CLIENT | yes | 300/guest | yes |
| Check-in | STAFF/CLIENT | no | no | no |