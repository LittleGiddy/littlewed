import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { generateGuestToken } from '@/lib/qr'; // ✅ Import the function

export default async function GuestPage({ params }: { params: { token: string } }) {
  // ─── Find guest by token ──────────────────────────────────────────────
  const guest = await prisma.guest.findFirst({
    where: { qrToken: params.token },
    include: { event: true },
  });

  if (!guest) return notFound();

  // ─── Generate a fresh token for the QR code ───────────────────────────
  const qrToken = generateGuestToken(guest.id, guest.eventId);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6">
        <h1 className="font-serif text-2xl font-bold text-[#0D4F4F]">
          Welcome, {guest.title || 'Mr'} {guest.name}!
        </h1>
        <p className="text-gray-500 text-sm">Event Details</p>
        
        <div className="mt-4 space-y-3">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">Event</span>
            <span className="font-semibold">{guest.event.name}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">Date</span>
            <span className="font-semibold">{new Date(guest.event.date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">Venue</span>
            <span className="font-semibold">{guest.event.venue}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">Card Number</span>
            <span className="font-semibold">{guest.cardNumber || 'N/A'}</span>
          </div>
        </div>

        {/* ─── QR Code ────────────────────────────────────────────────────── */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl text-center">
          <p className="text-sm text-gray-500 mb-2">Your Check-in QR Code</p>
          {/* ✅ Use the QR token in the img src */}
          <img
            src={`/api/guest/qr/${qrToken}`}
            alt="QR Code"
            className="w-32 h-32 mx-auto"
          />
          <p className="text-xs text-gray-400 mt-2">
            Card: {guest.cardNumber || 'N/A'}
          </p>
        </div>

        <Link
          href={`/guest/confirm/${guest.id}`}
          className="block w-full mt-4 bg-[#0D4F4F] text-white text-center py-3 rounded-xl font-bold hover:bg-[#0A3D3D] transition"
        >
          Confirm Attendance ✅
        </Link>
      </div>
    </div>
  );
}