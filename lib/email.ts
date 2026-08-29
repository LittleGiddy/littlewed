import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = 'LittleWed <credits@littlewed.co.tz>';
const APP_URL = 'https://littlewed.co.tz';

// ─── Super admin notifications ────────────────────────────────────────────
// All admin alerts (new signups, approvals, credit requests) go to this inbox.
export const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'gideonfelixy@gmail.com';

async function sendAdminAlert(
  subject: string,
  title: string,
  rows: { label: string; value: string }[],
  actionLabel: string,
  actionUrl: string
) {
  await resend.emails.send({
    from: 'LittleWed Admin <admin@littlewed.co.tz>',
    to: SUPER_ADMIN_EMAIL,
    subject,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0D4B4B; padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; font-size: 24px; margin: 0;">LittleWed Admin</h1>
        </div>
        <div style="background: #f8fafb; padding: 32px; border: 1px solid #e8ecef; border-top: none;">
          <h2 style="color: #1a2b3c; font-size: 20px; margin: 0 0 12px;">${title}</h2>
          <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e8ecef;">
            <table style="width: 100%; border-collapse: collapse;">
              ${rows
                .map(
                  (r) => `
                  <tr>
                    <td style="padding: 6px 0; color: #718096; font-size: 14px;">${r.label}</td>
                    <td style="padding: 6px 0; color: #1a2b3c; font-size: 14px; font-weight: 700; text-align: right;">${r.value}</td>
                  </tr>`
                )
                .join('')}
            </table>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${actionUrl}" style="display: inline-block; background: #FF6B5C; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">${actionLabel}</a>
          </div>
        </div>
        <div style="padding: 16px 32px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">LittleWed - Admin Notifications</p>
        </div>
      </div>
    `,
  });
}

// Notify super admin that a brand-new user just signed up and needs approval.
export async function sendNewSignupToAdmin(params: {
  name: string;
  email: string;
  phone?: string | null;
  tenantName?: string;
  subdomain?: string;
  method: 'email' | 'google';
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Name', value: params.name || '-' },
    { label: 'Email', value: params.email },
    { label: 'Method', value: params.method },
  ];
  if (params.phone) rows.push({ label: 'Phone', value: params.phone });
  if (params.tenantName) rows.push({ label: 'Organization', value: params.tenantName });
  if (params.subdomain) rows.push({ label: 'Subdomain', value: `${params.subdomain}.littlewed.co.tz` });

  await sendAdminAlert(
    `New user signed up - ${params.name || params.email}`,
    'New User Signup',
    rows,
    'View Pending Users',
    `${APP_URL}/admin/users`
  );
}

// Notify super admin that an existing pending account is requesting approval/activation.
export async function sendApprovalRequestToAdmin(params: {
  name: string;
  email: string;
  tenantName?: string;
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Name', value: params.name || '-' },
    { label: 'Email', value: params.email },
  ];
  if (params.tenantName) rows.push({ label: 'Organization', value: params.tenantName });

  await sendAdminAlert(
    `Approval request - ${params.name || params.email}`,
    'Account Awaiting Approval',
    rows,
    'Review & Approve',
    `${APP_URL}/admin/users`
  );
}

export async function sendEventReminderEmail(to: string, eventName: string, eventDate: Date) {
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  await resend.emails.send({
    from: 'LittleWed <noreply@littlewed.co.tz>',
    to,
    subject: `Reminder: ${eventName} is in 24 hours!`,
    html: `
      <h2>⏰ ${eventName}</h2>
      <p>Your event is happening in the next 24 hours!</p>
      <p><strong>Date & Time:</strong> ${formattedDate}</p>
      <p>Visit your dashboard to finalize any last-minute details.</p>
      <a href="${APP_URL}/dashboard">Go to Dashboard →</a>
    `,
  });
}

export async function sendEventExpiredEmail(to: string, eventName: string) {
  await resend.emails.send({
    from: 'LittleWed <noreply@littlewed.co.tz>',
    to,
    subject: `⚠️ ${eventName} has been paused`,
    html: `
      <h2>⚠️ ${eventName} is now paused</h2>
      <p>Your event has passed and is now <strong>inactive</strong>.</p>
      <p>All features (guest check-in, invitations, etc.) have been disabled.</p>
      <p><strong>You have 7 days to resume this event.</strong></p>
      <a href="${APP_URL}/client/dashboard">Go to Dashboard →</a>
      <hr />
      <p style="color: #888; font-size: 13px;">If you don't resume, it will be permanently archived.</p>
    `,
  });
}

// ─── Credit Request Emails ───────────────────────────────────────────────

export async function sendCreditRequestSubmittedEmail(
  to: string,
  userName: string,
  credits: number,
  amountTZS: number
) {
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Credit Request Received - ${credits} credits`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0D4B4B; padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; font-size: 24px; margin: 0;">LittleWed</h1>
        </div>
        <div style="background: #f8fafb; padding: 32px; border: 1px solid #e8ecef; border-top: none;">
          <h2 style="color: #1a2b3c; font-size: 20px; margin: 0 0 12px;">Hi ${userName},</h2>
          <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
            Your credit request has been received and is <strong style="color: #0D4B4B;">on queue</strong>.
          </p>
          <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e8ecef;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #718096; font-size: 14px;">Credits requested</td>
                <td style="padding: 6px 0; color: #1a2b3c; font-size: 14px; font-weight: 700; text-align: right;">${credits}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #718096; font-size: 14px;">Amount</td>
                <td style="padding: 6px 0; color: #1a2b3c; font-size: 14px; font-weight: 700; text-align: right;">${amountTZS.toLocaleString()} TZS</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #718096; font-size: 14px;">Status</td>
                <td style="padding: 6px 0; font-size: 14px; text-align: right;">
                  <span style="background: #fef3cd; color: #856404; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700;">Pending Review</span>
                </td>
              </tr>
            </table>
          </div>
          <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            Our team will review your request shortly. You'll receive another email once your credits have been granted.
          </p>
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="color: #856404; font-size: 14px; margin: 0; line-height: 1.5;">
              <strong>Need help?</strong> Contact the administrator at<br />
              <a href="tel:+255702529514" style="color: #0D4B4B; font-weight: 700; text-decoration: none;">+255 702 529 514</a>
            </p>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${APP_URL}/client/billing" style="display: inline-block; background: #0D4B4B; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">View Billing →</a>
          </div>
        </div>
        <div style="padding: 16px 32px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">LittleWed - Wedding Management Platform</p>
        </div>
      </div>
    `,
  });
}

export async function sendCreditGrantedEmail(
  to: string,
  userName: string,
  credits: number,
  amountTZS: number
) {
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `🎉 ${credits} Credits Granted!`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0D4B4B; padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; font-size: 24px; margin: 0;">LittleWed</h1>
        </div>
        <div style="background: #f8fafb; padding: 32px; border: 1px solid #e8ecef; border-top: none;">
          <h2 style="color: #1a2b3c; font-size: 20px; margin: 0 0 12px;">Great news, ${userName}!</h2>
          <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
            Your credit request has been <strong style="color: #0D4B4B;">approved</strong> and the credits have been added to your account.
          </p>
          <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e8ecef;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #718096; font-size: 14px;">Credits granted</td>
                <td style="padding: 6px 0; color: #0D4B4B; font-size: 18px; font-weight: 900; text-align: right;">${credits}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #718096; font-size: 14px;">Amount</td>
                <td style="padding: 6px 0; color: #1a2b3c; font-size: 14px; font-weight: 700; text-align: right;">${amountTZS.toLocaleString()} TZS</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #718096; font-size: 14px;">Status</td>
                <td style="padding: 6px 0; font-size: 14px; text-align: right;">
                  <span style="background: #d4edda; color: #155724; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700;">Approved ✓</span>
                </td>
              </tr>
            </table>
          </div>
          <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            You can now use these credits to create events, add guests, and send invitations.
          </p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${APP_URL}/client/dashboard" style="display: inline-block; background: #0D4B4B; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">Go to Dashboard →</a>
          </div>
        </div>
        <div style="padding: 16px 32px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">LittleWed - Wedding Management Platform</p>
        </div>
      </div>
    `,
  });
}

export async function sendCreditRequestToAdmin(  adminEmail: string,
  userName: string,
  tenantName: string,
  credits: number,
  amountTZS: number,
  reason: string | null
) {
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: adminEmail,
    subject: `New Credit Request - ${tenantName} (${credits} credits)`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0D4B4B; padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; font-size: 24px; margin: 0;">LittleWed Admin</h1>
        </div>
        <div style="background: #f8fafb; padding: 32px; border: 1px solid #e8ecef; border-top: none;">
          <h2 style="color: #1a2b3c; font-size: 20px; margin: 0 0 12px;">New Credit Request</h2>
          <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
            A user has requested credits that need your review.
          </p>
          <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e8ecef;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #718096; font-size: 14px;">User</td>
                <td style="padding: 6px 0; color: #1a2b3c; font-size: 14px; font-weight: 600; text-align: right;">${userName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #718096; font-size: 14px;">Organization</td>
                <td style="padding: 6px 0; color: #1a2b3c; font-size: 14px; font-weight: 600; text-align: right;">${tenantName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #718096; font-size: 14px;">Credits requested</td>
                <td style="padding: 6px 0; color: #0D4B4B; font-size: 18px; font-weight: 900; text-align: right;">${credits}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #718096; font-size: 14px;">Amount</td>
                <td style="padding: 6px 0; color: #1a2b3c; font-size: 14px; font-weight: 700; text-align: right;">${amountTZS.toLocaleString()} TZS</td>
              </tr>
              ${reason ? `
              <tr>
                <td style="padding: 6px 0; color: #718096; font-size: 14px;">Reason</td>
                <td style="padding: 6px 0; color: #1a2b3c; font-size: 14px; text-align: right;">${reason}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${APP_URL}/admin/credit-requests" style="display: inline-block; background: #FF6B5C; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">Review Request →</a>
          </div>
        </div>
        <div style="padding: 16px 32px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">LittleWed - Admin Notifications</p>
        </div>
      </div>
    `,
  });
}

// ─── Broadcast Email (Super Admin) ───────────────────────────────────────

export async function sendBroadcastEmail(
  toAddresses: string[],
  subject: string,
  htmlBody: string
) {
  const from = 'LittleWed Admin <admin@littlewed.co.tz>';
  const results: Record<string, boolean> = {};

  for (const to of toAddresses) {
    try {
      await resend.emails.send({ from, to, subject, html: htmlBody });
      results[to] = true;
    } catch (err) {
      console.error('Broadcast email failed for', to, err);
      results[to] = false;
    }
  }

  return results;
}
