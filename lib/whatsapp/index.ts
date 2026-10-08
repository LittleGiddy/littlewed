// lib/whatsapp/index.ts

const NEXTSMS_TOKEN = process.env.NEXTSMS_TOKEN!;
const DEFAULT_NEXTSMS_ACCOUNT = process.env.NEXTSMS_ACCOUNT || '';
const NEXTSMS_API_URL = 'https://messaging-service.co.tz/api/whatsapp/v2/text/single';

export interface SendWhatsAppTemplateOptions {
  to: string | string[];
  template: string;
  /**
   * NexSMS `account` - the name of the WhatsApp Business account the template
   * is registered under. This is per-tenant (Tenant.whatsappAccount); the env
   * var is only a last-resort fallback. The provider rejects the whole request
   * with HTTP 422 "Account name does not exist or not active" when it is wrong.
   */
  account?: string;
  personalisation?: Record<string, string>[];
  header?: {
    image?: { file: string; name?: string };
    document?: { file: string; name?: string };
  };
  button?: {
    personalisation: {
      url_link: {
        parameters: string[];
      };
    };
  };
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  data?: any;
}

export async function sendWhatsAppTemplate({
  to,
  template,
  account,
  personalisation,
  header,
  button,
}: SendWhatsAppTemplateOptions): Promise<SendWhatsAppResult> {
  if (!NEXTSMS_TOKEN) {
    return { success: false, error: 'NEXTSMS_TOKEN is not set' };
  }

  // Prefer the caller's (tenant's) account, then the env fallback. Never send an
  // empty account: the provider answers 422 and every send silently fails.
  const nexSmsAccount = account?.trim() || DEFAULT_NEXTSMS_ACCOUNT;
  if (!nexSmsAccount) {
    return {
      success: false,
      error:
        'WhatsApp account is not configured. Set the tenant WhatsApp account (admin → tenant settings) or NEXTSMS_ACCOUNT.',
    };
  }

  const toArray = Array.isArray(to) ? to : [to];
  const cleanTo = toArray.map(phone => parseInt(phone.replace(/^\+/, '').replace(/\D/g, '')));

  const body: any = {
    to: cleanTo,
    account: nexSmsAccount,
    template: template,
  };

  if (personalisation) {
    body.personalisation = personalisation;
  }

  if (header) {
    body.header = header;
  }

  if (button) {
    body.button = button;
  }

  console.log('[WhatsApp] ====== SENDING MESSAGE ======');
  console.log('[WhatsApp] Template:', template);
  console.log('[WhatsApp] Account:', nexSmsAccount);
  console.log('[WhatsApp] To:', cleanTo);
  console.log('[WhatsApp] Payload:', JSON.stringify(body, null, 2));

  try {
    const response = await fetch(NEXTSMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${NEXTSMS_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    // ─── Guard against non-JSON bodies (proxy/gateway HTML error pages) ────
    // A thrown JSON parse error would be reported as a generic network error
    // and silently trigger the SMS fallback, hiding the real cause.
    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();
    let data: any = null;
    if (rawBody.trim() && contentType.includes('json')) {
      try {
        data = JSON.parse(rawBody);
      } catch {
        data = null;
      }
    }

    console.log('[WhatsApp] Response Status:', response.status);
    console.log('[WhatsApp] Response Data:', rawBody.substring(0, 2000));

    if (!response.ok) {
      let errorMsg = data?.message || data?.error || `HTTP ${response.status}`;

      // The provider returns per-field errors, e.g.
      //   { errors: { account: ["Account name does not exist or not active"],
      //               template: ["Template name does not exist ..."] } }
      // on HTTP 422. Flatten them so the actionable reason is never lost.
      const fieldErrors: string[] = [];
      if (data?.errors) {
        if (Array.isArray(data.errors)) {
          fieldErrors.push(data.errors.map((e: any) => e.message || e).join(', '));
        } else if (typeof data.errors === 'object') {
          for (const [field, msgs] of Object.entries(data.errors as Record<string, unknown>)) {
            fieldErrors.push(`${field}: ${Array.isArray(msgs) ? msgs.join(' ') : String(msgs)}`);
          }
        } else {
          fieldErrors.push(String(data.errors));
        }
      }
      if (fieldErrors.length > 0) {
        errorMsg = fieldErrors.join(' | ');
      }

      if (response.status === 400 || response.status === 422) {
        console.error(
          `[WhatsApp] ❌ Template/account rejected (HTTP ${response.status}) - account="${nexSmsAccount}" template="${template}"`
        );
        // Name the account and template in the surfaced error: a wrong
        // `account` is the single most common cause and must be visible.
        errorMsg = `WhatsApp rejected the send (HTTP ${response.status}) - ${errorMsg} [account="${nexSmsAccount}", template="${template}"]`;
      } else if (response.status === 401) {
        console.error('[WhatsApp] ❌ Authentication failed - Check NEXTSMS_TOKEN');
        errorMsg = 'Authentication failed. Please check your API token.';
      } else if (response.status === 429) {
        console.error('[WhatsApp] ❌ Rate limit exceeded - Too many messages');
        errorMsg = 'Rate limit exceeded. Please wait and try again.';
      } else if (response.status === 403) {
        console.error('[WhatsApp] ❌ Forbidden - Template might not be approved');
        errorMsg = 'Template not approved or account restricted.';
      }

      if (!rawBody.trim()) {
        errorMsg = `WhatsApp send failed with an empty response body (HTTP ${response.status}) [account="${nexSmsAccount}"]`;
      }

      return { success: false, error: errorMsg, data };
    }

    if (!data) {
      return {
        success: false,
        error: `WhatsApp send returned a non-JSON response (HTTP ${response.status}) [account="${nexSmsAccount}"]`,
        data: { text: rawBody.substring(0, 500) },
      };
    }

    console.log('[WhatsApp] ✅ Message accepted by NexSMS');

    const messageId = data.messages?.[0]?.messageId || data.data?.messageId || data.messageId || data.id;

    // Never hand back the string "undefined" - callers use a falsy messageId to
    // synthesise a local id, and "undefined" would create unmatchable logs.
    return { success: true, messageId: messageId ? String(messageId) : undefined, data };
  } catch (error: any) {
    console.error('[WhatsApp] ❌ Error sending template:', error.message);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// ─── Wedding Invitation Template ──────────────────────────────────────

export async function sendWeddingInvitation(
  phone: string,
  data: {
    guestName: string;
    hostFamily: string;
    person1: string;
    person2: string;
    date: string;
    venue: string;
    time: string;
    cardNumber: string;
    cardType: string;
    imageUrl?: string;
    inviteLink?: string;
    templateName?: string; // e.g. 'Mwalikotemp' | 'Mwalikosecond' | 'MwalikoForth'
    contact?: string;     // {var10} for Mwalikosecond, {var11} for MwalikoForth
    eventType?: string;   // {var3} event type for MwalikoForth (e.g. 'harusi')
    account?: string;     // tenant's NexSMS account name
  }
): Promise<SendWhatsAppResult> {
  console.log('[WhatsApp] ====== SENDING WEDDING INVITATION ======');
  const templateName = data.templateName || 'Mwalikotemp';
  console.log('[WhatsApp] Template:', templateName);

  // ─── Header with image ────────────────────────────────────────────────
  // Only attach a header when a real card image exists - never a placeholder.
  const header = data.imageUrl
    ? {
        image: {
          file: data.imageUrl,
          name: 'Wedding Invitation',
        }
      }
    : undefined;

  // ─── Button with dynamic URL ──────────────────────────────────────────
  let button = undefined;
  if (data.inviteLink) {
    const slug = toLinkSuffix(data.inviteLink);
    button = {
      personalisation: {
        url_link: {
          parameters: [slug],
        },
      },
    };
  }

  // ─── Send template with proper variable mapping ──────────────────────
  // MwalikoForth uses a different variable layout than Mwaliko(temp):
  //   {var1}=guest, {var2}=hostFamily, {var3}=eventType, {var4}=couple,
  //   {var5}=date, {var6}=venue, {var7}=time, {Var8}=cardNo,
  //   {var9}=cardType, {var10}=contact
  const isForth = templateName === 'MwalikoForth';

  const coupleName =
    data.person1 && data.person2
      ? `${data.person1} na ${data.person2}`
      : data.person1 || data.person2 || '';

  const personalisation: Record<string, string> = isForth
    ? {
        // "Habari {var1}"
        "var1": data.guestName,
        // "Familia ya {var2}"
        "var2": data.hostFamily,
        // "inakualika katika {var3} ya {var4}"
        "var3": data.eventType || 'harusi',
        "var4": coupleName,
        // "itakayofanyika tarehe {var5}"
        "var5": data.date,
        // "Mahali: {var6}"
        "var6": data.venue,
        // "Muda: Kuanzia saa {var7}"
        "var7": data.time,
        // "Card No: {Var8}"
        "Var8": data.cardNumber,
        // "{var9}" card type
        "var9": data.cardType,
        // "kwa mawasiliano zaidi: {var10}"
        ...(data.contact ? { "var10": data.contact } : {}),
      }
    : {
        // Legacy layout: Mwalikotemp / Mwalikosecond
        "var1": data.guestName,      // ✅ Habari {var1}
        "var2": data.hostFamily,     // ✅ Familia ya {var2}
        "var3": data.person1,        // ✅ {var3}
        "var4": data.person2,        // ✅ {var4}
        "var5": data.date,           // ✅ {var5}
        "var6": data.venue,          // ✅ {var6}
        "var7": data.time,           // ✅ {var7}
        "Var8": data.cardNumber,     // ✅ {Var8} - CAPITAL V!
        "var9": data.cardType,       // ✅ {var9}
        // Mwalikosecond adds {var10} for further contact info.
        ...(data.contact ? { "var10": data.contact } : {}),
      };

  return sendWhatsAppTemplate({
    to: phone,
    template: templateName,
    account: data.account,
    personalisation: [personalisation],
    header,
    button,
  });
}

// ─── Wedding Invitation Template with More Info button ────────────────
// "Mwaliko Sixth" carries a dynamic URL button (the url_link the template
// approved in the NexSMS dashboard) that opens the guest's unique page at
// littlewed.co.tz/invite/<passCode> with the wedding info + their card.

export async function sendWeddingInvitationPlus(
  phone: string,
  data: {
    guestName: string;
    hostFamily: string;
    area: string;          // {var3} e.g. "Tabata Kimanga - Dar es salaam"
    eventType: string;     // {var4} e.g. "SendOff ya Binti yao mpendwa"
    celebrant: string;     // {var5} e.g. "Norah Cyprian Ngiliule"
    date: string;          // {var6}
    venue: string;         // {var7}
    time: string;          // {var8}
    cardNumber: string;    // {var9} + {Var10} is the card type below
    cardType: string;      // {var10}
    contact1: string;      // {var11} first contact "John Pambalu: 0769999902"
    contact2: string;      // {var12} second contact
    imageUrl?: string;
    inviteLink?: string;
    account?: string;
  }
): Promise<SendWhatsAppResult> {
  console.log('[WhatsApp] ====== SENDING WEDDING INVITATION (PLUS) ======');
  console.log('[WhatsApp] Template: Mwaliko Sixth');

  const header = data.imageUrl
    ? {
        image: {
          file: data.imageUrl,
          name: 'Wedding Invitation',
        }
      }
    : undefined;

  // ─── Dynamic URL button (More Info) ────────────────────────────────
  // WhatsApp allows ONE URL button per template; the button text and the
  // base URL (https://littlewed.co.tz/invite/) are fixed on the approved
  // template, we only supply the per-guest passCode suffix.
  let button = undefined;
  if (data.inviteLink) {
    const slug = toLinkSuffix(data.inviteLink);
    button = {
      personalisation: {
        url_link: {
          parameters: [slug],
        },
      },
    };
  }

  const personalisation: Record<string, string> = {
    "var1": data.guestName,          // Habari {var1}
    "var2": data.hostFamily,         // Familia ya {var2}
    "var3": data.area,               // wa {var3}
    "var4": data.eventType,          // inakualika katika {var4}
    "var5": data.celebrant,          // {var5}
    "var6": data.date,               // itakayofanyika tarehe {var6}
    "var7": data.venue,              // Ukumbi: {var7}
    "var8": data.time,               // Muda: {var8}
    "Var9": data.cardNumber,         // Card No: {Var9} — capital V!
    "var10": data.cardType,          // {var10}
    "var11": data.contact1,          // kwa mawasiliano zaidi: {var11}
    "var12": data.contact2,          // {var12}
  };

  return sendWhatsAppTemplate({
    to: phone,
    template: 'Mwaliko Sixth',
    account: data.account,
    personalisation: [personalisation],
    header,
    button,
  });
}

// ─── Wedding Invitation Template: "Event" (Kadi ya Mualiko Ukumbini) ────
// A fixed approved template for the MdaKumbe TV Blue & White night. The body
// is static except {var1} (guest name) and {var2} (card number); it carries
// the guest card image as its header but has NO URL button.

export async function sendWeddingInvitationUkumbini(
  phone: string,
  data: {
    guestName: string;      // {var1}
    cardNumber: string;     // {var2}
    imageUrl?: string;
    account?: string;       // tenant's NexSMS account name
  }
): Promise<SendWhatsAppResult> {
  console.log('[WhatsApp] ====== SENDING KADI YA MUALIKO UKUMBINI ======');
  console.log('[WhatsApp] Template: Event');

  const header = data.imageUrl
    ? {
        image: {
          file: data.imageUrl,
          name: 'Wedding Invitation',
        }
      }
    : undefined;

  const personalisation: Record<string, string> = {
    "var1": data.guestName,
    "var2": data.cardNumber,
  };

  return sendWhatsAppTemplate({
    to: phone,
    template: 'Event',
    account: data.account,
    personalisation: [personalisation],
    header,
  });
}

// ─── Helper: Convert full URL to slug ──────────────────────────────────

export function toLinkSuffix(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || value;
  } catch {
    return value;
  }
}

/**
 * Sends a "Thank You" message over WhatsApp using an approved template that
 * embeds ONE card image (no text variables). The same card is sent to every
 * checked-in WhatsApp guest.
 *
 * The approved template name is provided at runtime; it defaults to an env
 * var (THANKS_WHATSAPP_TEMPLATE) so it can be updated once approved.
 */
export async function sendWhatsAppThanksCard({
  to,
  cardUrl,
  templateName,
}: {
  to: string;
  cardUrl: string;
  templateName: string;
}): Promise<SendWhatsAppResult> {
  console.log('[WhatsApp] ====== SENDING THANKS CARD ======');
  console.log('[WhatsApp] Template:', templateName);
  return sendWhatsAppTemplate({
    to,
    template: templateName,
    header: {
      image: { file: cardUrl, name: 'Thank You' },
    },
  });
}

export function getThanksWhatsAppTemplate(): string {
  return process.env.THANKS_WHATSAPP_TEMPLATE || 'mwalikothanks';
}

/**
 * Sends the approved "Mchango" contribution reminder to a single guest.
 *
 * The template is a broadcast body: var1..var13 are event-level values (occasion,
 * names, venue, date, payment instructions, contact), so the personalisation is
 * built once per send in `buildMchangoPersonalisation` and reused for every
 * guest. Per-guest personalisation comes from the reminder card, which is
 * attached as the template header image.
 *
 * `account` is the tenant's NexSMS account name. It is threaded through on
 * purpose: the provider answers HTTP 422 for the whole request when the account
 * is wrong, and reminders used to silently fall back to the env var and ignore
 * Tenant.whatsappAccount.
 */
export async function sendWhatsAppReminder({
  to,
  personalisation,
  templateName,
  cardUrl,
  account,
}: {
  to: string;
  personalisation: Record<string, string>[];
  templateName: string;
  cardUrl?: string;
  account?: string | null;
}): Promise<SendWhatsAppResult> {
  console.log('[WhatsApp] ====== SENDING MCHANGO REMINDER ======');
  console.log('[WhatsApp] Template:', templateName, '| account:', account ?? '(env fallback)');
  const header = cardUrl
    ? { image: { file: cardUrl, name: 'Reminder Card' } }
    : undefined;
  return sendWhatsAppTemplate({
    to,
    template: templateName,
    account: account ?? undefined,
    personalisation,
    header,
  });
}