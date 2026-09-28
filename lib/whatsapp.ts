// lib/whatsapp.ts

// ─── NexSMS Configuration ──────────────────────────────────────────────
const NEXTSMS_API_URL = 'https://messaging-service.co.tz/api/whatsapp/v2/text/single';
const NEXTSMS_TOKEN = process.env.NEXTSMS_TOKEN;
// No hardcoded account fallback: a wrong account name makes the provider reject
// every send with HTTP 422, which previously failed silently. Callers pass the
// tenant's account, then we fall back to the env value, and error if neither
// is configured.
const NEXTSMS_ACCOUNT = process.env.NEXTSMS_ACCOUNT;
const isMock = process.env.MOCK_SMS === 'true';

export interface SendMessageParams {
  to: string;
  type: 'text' | 'template';
  text?: string;
  templateName?: string;
  templateParams?: string[];
  imageUrl?: string;
  buttonUrl?: string;
  account?: string; // tenant's NexSMS account name
}

// ─── Helper: Send WhatsApp via NexSMS ──────────────────────────────────
async function sendWhatsAppViaNexSMS(params: {
  to: number;
  template: string;
  personalisation?: Record<string, string>[];
  header?: {
    image?: { file: string; name?: string };
    document?: { file: string; name?: string };
  };
  button?: { url: string };
  account?: string;
}) {
  const { to, template, personalisation, header, button } = params;

  // Prefer the caller's (tenant's) account, then the env fallback.
  const account = params.account?.trim() || NEXTSMS_ACCOUNT;
  if (!account) {
    throw new Error(
      'WhatsApp account is not configured. Set the tenant WhatsApp account (admin → tenant settings) or NEXTSMS_ACCOUNT.'
    );
  }

  const body: any = {
    to: [to],
    account,
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

  const response = await fetch(NEXTSMS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${NEXTSMS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  // Guard against non-JSON bodies so a proxy/gateway error page is not
  // reported as a generic parse failure.
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

  if (!response.ok) {
    let errorMsg = data?.message || data?.error || `HTTP ${response.status}`;

    // The provider returns per-field errors, e.g.
    //   { errors: { account: ["Account name does not exist or not active"] } }
    // on HTTP 422. Flatten them so an invalid account is never lost.
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
    if (!rawBody.trim()) {
      errorMsg = `WhatsApp send failed with an empty response body (HTTP ${response.status}) [account="${account}"]`;
    }
    // Name the account and template: a wrong `account` is the most common cause.
    throw new Error(`${errorMsg} [account="${account}", template="${template}"]`);
  }

  if (!data) {
    throw new Error(
      `WhatsApp send returned a non-JSON response (HTTP ${response.status}) [account="${account}"]`
    );
  }

  return data;
}

// ─── Main Send Function ─────────────────────────────────────────────────
export async function sendWhatsAppMessage(params: SendMessageParams) {
  const { to, type, text, templateName, templateParams, imageUrl, buttonUrl, account } = params;

  if (!to) {
    return { success: false, error: 'Phone number is required' };
  }

  // Clean phone number (remove + and any non-digit characters)
  const cleanTo = to.replace(/^\+/, '').replace(/\D/g, '');

  if (!/^[0-9]{10,15}$/.test(cleanTo)) {
    return { success: false, error: 'Invalid phone number format' };
  }

  // Convert to number for NexSMS
  const phoneNumber = parseInt(cleanTo);

  try {
    // ─── Mock mode ──────────────────────────────────────────────────────
    if (isMock) {
      console.log(`[MOCK] WhatsApp to ${cleanTo}:`);
      console.log(`  Type: ${type}`);
      console.log(`  Template: ${templateName || 'N/A'}`);
      console.log(`  Params: ${templateParams?.join(', ') || 'N/A'}`);
      return { 
        success: true, 
        data: { mock: true, messageId: 'mock_' + Date.now() },
        message: 'Mock message sent successfully'
      };
    }

    // ─── Text Message ──────────────────────────────────────────────────
    if (type === 'text' && text) {
      // NexSMS doesn't support free-text WhatsApp messages directly
      // You would need a template for this, or use a generic template
      return { 
        success: false, 
        error: 'NexSMS requires templates for WhatsApp messages. Please use a template.' 
      };
    }

    // ─── Template Message ──────────────────────────────────────────────
    if (type === 'template' && templateName) {
      // Build personalisation from templateParams
      const personalisation = templateParams && templateParams.length > 0
        ? [templateParams.reduce((acc, param, index) => {
            acc[String(index + 1)] = param;
            return acc;
          }, {} as Record<string, string>)]
        : undefined;

      // Prepare header image if provided
      const header = imageUrl ? {
        image: {
          file: imageUrl,
          name: 'Wedding Invitation',
        }
      } : undefined;

      // Prepare button if provided
      const button = buttonUrl ? {
        url: buttonUrl,
      } : undefined;

      const result = await sendWhatsAppViaNexSMS({
        to: phoneNumber,
        template: templateName,
        personalisation,
        header,
        button,
        account,
      });

      return { success: true, data: result };
    }

    return { success: false, error: 'Invalid message type or missing parameters' };
  } catch (error: any) {
    console.error('[WhatsApp] Send error:', error);
    return { success: false, error: error.message || 'Failed to send WhatsApp message' };
  }
}

// ─── Send Invitation Template ───────────────────────────────────────────
export async function sendInvitationTemplate(
  guest: {
    phone: string | null;
    name: string;
    cardNumber: string | null;
    title?: string | null;
  },
  event: {
    name: string;
    date: Date | string;
    venue: string;
    time?: string;
    hostFamily?: string;
    person1?: string;
    person2?: string;
    imageUrl?: string;
  },
  customParams?: {
    imageUrl?: string;
    buttonUrl?: string;
    account?: string; // tenant's NexSMS account name
  }
) {
  if (!guest.phone) {
    return { success: false, error: 'Guest has no phone number' };
  }

  const fullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
  const cardNumber = guest.cardNumber || '';

  const eventDate = typeof event.date === 'string' ? new Date(event.date) : event.date;
  const formattedDate = eventDate.toLocaleDateString('sw-TZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = event.time || eventDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Match template placeholders: {1} through {9}
  // Variable values come from the user's event/guest data - no hardcoded fallbacks.
  const params = [
    fullName,                                    // {1}
    event.hostFamily || '',                      // {2}
    event.person1 || '',                         // {3}
    event.person2 || '',                         // {4}
    formattedDate,                               // {5}
    event.venue || '',                           // {6}
    formattedTime,                               // {7}
    cardNumber,                                  // {8}
    guest.title || '',                           // {9}
  ];

  // Generate a dynamic invite link
  const inviteLink = customParams?.buttonUrl || `https://littlewed.co.tz/invite/${guest.phone}`;
  const imageUrl = customParams?.imageUrl || event.imageUrl || '';

  return await sendWhatsAppMessage({
    to: guest.phone,
    type: 'template',
    templateName: 'event_invitation',
    templateParams: params,
    imageUrl: imageUrl,
    buttonUrl: inviteLink,
    account: customParams?.account,
  });
}

// ─── Send Reminder Template ─────────────────────────────────────────────
export async function sendReminderTemplate(
  guest: {
    phone: string | null;
    name: string;
    title?: string | null;
  },
  event: {
    name: string;
    date: Date | string;
    venue: string;
    time?: string;
  }
) {
  if (!guest.phone) {
    return { success: false, error: 'Guest has no phone number' };
  }

  const fullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;

  const eventDate = typeof event.date === 'string' ? new Date(event.date) : event.date;
  const formattedDate = eventDate.toLocaleDateString('sw-TZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = event.time || eventDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const params = [
    fullName,
    event.name,
    formattedDate,
    event.venue,
    formattedTime,
  ];

  return await sendWhatsAppMessage({
    to: guest.phone,
    type: 'template',
    templateName: 'event_reminder',
    templateParams: params,
  });
}

// ─── Test Function ──────────────────────────────────────────────────────
export async function testWhatsAppConnection(to: string) {
  if (!to) {
    return { success: false, error: 'Phone number is required' };
  }

  const cleanTo = to.replace(/^\+/, '').replace(/\D/g, '');

  if (!/^[0-9]{10,15}$/.test(cleanTo)) {
    return { success: false, error: 'Invalid phone number format' };
  }

  try {
    if (isMock) {
      console.log(`[MOCK] WhatsApp test to ${cleanTo}`);
      return { 
        success: true, 
        message: 'Mock WhatsApp connection successful!',
        data: { mock: true }
      };
    }

    // Use a simple template for testing
    const result = await sendWhatsAppViaNexSMS({
      to: parseInt(cleanTo),
      template: 'hello_world',
    });

    return { 
      success: true, 
      message: 'WhatsApp connection successful!',
      data: result 
    };
  } catch (error: any) {
    console.error('[WhatsApp] Test error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to test WhatsApp connection' 
    };
  }
}