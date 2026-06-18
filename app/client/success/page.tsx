'use client';
import { useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

export default function CheckInSuccess() {
  const searchParams = useSearchParams();
  const name = searchParams.get('name') || 'Guest';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="font-serif text-2xl font-bold text-gray-900">Welcome, {name}!</h1>
        <p className="text-gray-500 mt-2">You have been checked in successfully.</p>
      </div>
    </div>
  );
}