// app/data-deletion/page.tsx
import Link from 'next/link';

export const metadata = {
  title: 'Data Deletion Request - LittleWed',
  description: 'Request deletion of your data from LittleWed',
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-black text-[#0D4F4F]">Data Deletion Request</h1>
          <p className="text-gray-500 mt-2">LittleWed · Wedding Management Platform</p>
        </div>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <div className="bg-[#F0F9F9] rounded-xl p-4 border border-[#0D4F4F]/20">
            <p className="text-sm font-medium text-[#0D4F4F] flex items-center gap-2">
              <span className="text-xl">ℹ️</span>
              Important Information
            </p>
            <p className="text-sm mt-1">
              LittleWed does <strong>not</strong> store any personal data from Facebook or Meta. 
              Our app uses System User Tokens for server-to-server WhatsApp API calls and does 
              not receive or store Facebook user IDs, email addresses, profile pictures, or access tokens.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-800 text-lg">What Data Does LittleWed Store?</h2>
            <p className="text-sm mt-1">
              LittleWed stores only the data you provide directly to the platform:
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
              <li><strong>Account Information:</strong> Your name and email address (for login)</li>
              <li><strong>Event Data:</strong> Event details, guest lists, and invitation designs</li>
              <li><strong>Guest Data:</strong> Guest names and phone numbers (provided by you)</li>
              <li><strong>Usage Data:</strong> Messages sent via WhatsApp and SMS</li>
            </ul>
            <p className="text-sm mt-2 text-gray-500">
              We do <strong>not</strong> receive or store any personal data from Meta (Facebook/WhatsApp) users.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-800 text-lg">How to Request Data Deletion</h2>
            <p className="text-sm mt-1">
              If you would like to request deletion of your data from LittleWed, please follow these steps:
            </p>
            <ol className="list-decimal pl-5 mt-2 text-sm space-y-2">
              <li>
                <strong>Send an email</strong> to{' '}
                <a href="mailto:privacy@littlewed.co.tz" className="text-[#0D4F4F] font-semibold hover:underline">
                  privacy@littlewed.co.tz
                </a>
              </li>
              <li>
                <strong>Include your account email address</strong> and specify that you are requesting data deletion.
              </li>
              <li>
                <strong>We will process your request</strong> within 30 days and confirm when your data has been deleted.
              </li>
            </ol>
          </div>

          <div>
            <h2 className="font-semibold text-gray-800 text-lg">Response Timeline</h2>
            <p className="text-sm mt-1">
              We will acknowledge your request within <strong>48 hours</strong> and complete the deletion 
              process within <strong>30 days</strong> as required by privacy regulations.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Contact:</strong>{' '}
              <a href="mailto:privacy@littlewed.co.tz" className="text-[#0D4F4F] hover:underline">
                privacy@littlewed.co.tz
              </a>
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Phone:</strong> +255 632 362 033
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Address:</strong> Mahiri Global Ltd, Dar es Salaam, Tanzania
            </p>
          </div>

          <div className="text-center pt-4 border-t border-gray-200">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-[#0D4F4F] font-semibold hover:underline"
            >
              ← Back to LittleWed
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}