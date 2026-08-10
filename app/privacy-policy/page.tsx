// app/privacy-policy/page.tsx
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - LittleWed',
  description: 'Privacy policy for LittleWed wedding management platform',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        .pp-container {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          color: #1a202c;
          line-height: 1.7;
        }
        .pp-container h1 {
          font-family: 'Playfair Display', serif;
          font-size: 2.5rem;
          font-weight: 900;
          color: #0D4F4F;
          margin-bottom: 0.5rem;
        }
        .pp-container .last-updated {
          color: #718096;
          font-size: 0.9rem;
          margin-bottom: 2rem;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 1rem;
        }
        .pp-container h2 {
          font-size: 1.3rem;
          font-weight: 700;
          color: #0D4F4F;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
        }
        .pp-container p {
          color: #4a5568;
          margin-bottom: 1rem;
        }
        .pp-container ul {
          color: #4a5568;
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .pp-container ul li {
          margin-bottom: 0.5rem;
        }
        .pp-container .highlight {
          background: #f0f9f9;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          color: #0D4F4F;
          font-weight: 600;
        }
        .pp-container .contact-box {
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.5rem;
          margin-top: 2rem;
        }
      `}</style>

      <div className="pp-container">
        <h1>Privacy Policy</h1>
        <div className="last-updated">
          <strong>Last Updated:</strong> August 10, 2026
        </div>

        <p>
          At <strong>LittleWed</strong>, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information when you use our wedding management platform.
        </p>

        <h2>1. Information We Collect</h2>
        <p>We collect the following types of information:</p>
        <ul>
          <li><strong>Account Information:</strong> Your name, email address, phone number, and password when you create an account.</li>
          <li><strong>Event Information:</strong> Details about your events, including guest lists, dates, venues, and invitation designs.</li>
          <li><strong>Guest Information:</strong> Names, phone numbers, and email addresses of your guests (you are responsible for obtaining their consent).</li>
          <li><strong>Communication Data:</strong> Messages sent through our platform, including WhatsApp and SMS communications.</li>
          <li><strong>Payment Information:</strong> Billing details for credit purchases (processed through our secure payment partners).</li>
          <li><strong>Technical Data:</strong> IP address, browser type, device information, and usage patterns to improve our service.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide and maintain our wedding management services</li>
          <li>Send event invitations and reminders via WhatsApp and SMS</li>
          <li>Process credit purchases and billing</li>
          <li>Improve and personalise your experience</li>
          <li>Provide customer support</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>3. Data Sharing and Third Parties</h2>
        <p>
          We share your data only with trusted third-party service providers that help us operate our platform:
        </p>
        <ul>
          <li><strong>Meta (WhatsApp):</strong> To send WhatsApp messages and process communications</li>
          <li><strong>Twilio / NextSMS:</strong> To send SMS messages</li>
          <li><strong>Stripe:</strong> To process credit card payments</li>
          <li><strong>Vercel:</strong> To host our website and store data</li>
        </ul>
        <p>
          We <strong>never</strong> sell your personal data to third parties.
        </p>

        <h2>4. Data Security</h2>
        <p>
          We implement industry-standard security measures to protect your data, including encryption, secure servers, and access controls. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2>5. Data Retention</h2>
        <p>
          We retain your data for as long as your account is active or as needed to provide you with our services. You may request deletion of your data at any time by contacting us.
        </p>

        <h2>6. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Request corrections to inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Object to certain data processing activities</li>
          <li>Withdraw consent at any time</li>
        </ul>

        <h2>7. Cookies</h2>
        <p>
          We use cookies to enhance your experience, remember your preferences, and analyse site traffic. You can control cookie settings in your browser preferences.
        </p>

        <h2>8. Children's Privacy</h2>
        <p>
          Our services are not intended for children under 13, and we do not knowingly collect data from children. If you believe we have collected data from a child, please contact us immediately.
        </p>

        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.
        </p>

        <div className="contact-box">
          <h2 style={{ marginTop: 0 }}>10. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or how we handle your data, please contact us:
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Email:</strong> privacy@littlewed.co.tz<br />
            <strong>Phone:</strong> +255 632 362 033<br />
            <strong>Address:</strong> Mahiri Global Ltd, Dar es Salaam, Tanzania
          </p>
        </div>
      </div>
    </div>
  );
}