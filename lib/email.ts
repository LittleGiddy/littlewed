import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
      <a href="https://littlewed.co.tz/dashboard">Go to Dashboard →</a>
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
      <a href="https://littlewed.co.tz/dashboard/events/${eventName}">Resume Event →</a>
      <hr />
      <p style="color: #888; font-size: 13px;">If you don't resume, it will be permanently archived.</p>
    `,
  });
}