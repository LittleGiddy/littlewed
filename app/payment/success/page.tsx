import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export const metadata = {
  title: 'Payment Successful — LittleWed',
};

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D4B4B] via-[#0A3939] to-[#0D1B1B] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-5">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
          Payment Successful
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Thank you! Your credits have been added to your account. It may take a
          moment to reflect in your balance.
        </p>
        <Link
          href="/client/dashboard"
          className="block w-full bg-[#0D4B4B] hover:bg-[#0A3939] text-white text-sm font-bold py-3 px-6 rounded-xl transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}