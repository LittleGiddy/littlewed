// app/payment/checkout/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, ArrowLeft, Smartphone, CreditCard, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

type PaymentMethod = 'mpesa' | 'airtel_money' | 'tigo_pesa' | 'halopesa';

export default function PaymentCheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState(0);
  const [credits, setCredits] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');

  useEffect(() => {
    const paymentIdParam = searchParams.get('paymentId');
    const amountParam = searchParams.get('amount');
    const creditsParam = searchParams.get('credits');

    if (paymentIdParam) {
      setPaymentId(paymentIdParam);
    }
    if (amountParam) {
      setAmount(Number(amountParam));
    }
    if (creditsParam) {
      setCredits(Number(creditsParam));
    }

    // Fetch payment status periodically
    if (paymentIdParam) {
      const interval = setInterval(() => {
        fetchPaymentStatus(paymentIdParam);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [searchParams]);

  const fetchPaymentStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/payment/status?paymentId=${id}`);
      const data = await res.json();
      
      if (data.status === 'succeeded') {
        setStatus('success');
        toast.success('Payment successful! Credits added.');
      } else if (data.status === 'failed') {
        setStatus('failed');
        toast.error('Payment failed. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching payment status:', error);
    }
  };

  const handlePayment = async () => {
    if (!paymentId) {
      toast.error('Invalid payment');
      return;
    }

    if (paymentMethod === 'mpesa' && !phoneNumber) {
      toast.error('Please enter your phone number');
      return;
    }

    setProcessing(true);
    setStatus('processing');

    try {
      const res = await fetch('/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          paymentMethod,
          phoneNumber: phoneNumber || undefined,
        }),
      });

      const data = await res.json();

      if (data.success && data.status === 'succeeded') {
        setStatus('success');
        toast.success('Payment successful! 🎉');
        setTimeout(() => router.push('/client/dashboard'), 2000);
      } else {
        setStatus('failed');
        toast.error(data.error || 'Payment failed. Please try again.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setStatus('failed');
      toast.error('Network error. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const paymentMethods = [
    { id: 'mpesa', label: 'M-Pesa', icon: <Smartphone size={20} /> },
    { id: 'airtel_money', label: 'Airtel Money', icon: <Smartphone size={20} /> },
    { id: 'tigo_pesa', label: 'Tigo Pesa', icon: <Smartphone size={20} /> },
    { id: 'halopesa', label: 'HaloPesa', icon: <Smartphone size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-[#F5F8FA] py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-[#0D4F4F] transition mb-4"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#0D4F4F] to-[#E8A598]" />

          <div className="p-6">
            <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">Complete Payment</h1>
            <p className="text-gray-500 text-sm mb-6">Choose your payment method below.</p>

            {/* Order summary */}
            <div className="bg-[#F5F8FA] rounded-xl p-4 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Credits</span>
                <span className="font-semibold text-gray-900">{credits} credits</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-bold text-[#0D4F4F]">{amount.toLocaleString()} TZS</span>
              </div>
            </div>

            {/* Payment method selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                    className={`p-3 rounded-xl border-2 text-center transition ${
                      paymentMethod === method.id
                        ? 'border-[#0D4F4F] bg-[rgba(13,79,79,0.05)]'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700">
                      {method.icon}
                      {method.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Phone number for mobile money */}
            {['mpesa', 'airtel_money', 'tigo_pesa', 'halopesa'].includes(paymentMethod) && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 border border-r-0 border-gray-200 rounded-l-xl bg-gray-50 text-gray-500 text-sm">
                    +255
                  </span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="712345678"
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                    disabled={processing}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Enter phone number without country code</p>
              </div>
            )}

            {/* Status messages */}
            {status === 'processing' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 mb-4">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700">Processing your payment...</span>
              </div>
            )}

            {status === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 mb-4">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-700">Payment successful! Redirecting...</span>
              </div>
            )}

            {status === 'failed' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 mb-4">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm text-red-700">Payment failed. Please try again.</span>
              </div>
            )}

            {/* Pay button */}
            <button
              onClick={handlePayment}
              disabled={processing || status === 'success'}
              className="w-full py-3.5 bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Pay {amount.toLocaleString()} TZS</>
              )}
            </button>

            <p className="text-center text-xs text-gray-400 mt-4">
              Secure payment via ClickPesa
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}