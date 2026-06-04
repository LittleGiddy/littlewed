// app/send-invitations-server/[eventId]/page.tsx
import { prisma } from '@/lib/prisma';
import SendButton from '@/components/SendButtonClient';

export default async function SendInvitationsServerPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: {
      id: true,
      name: true,
      phone: true,
      invitationCard: true,
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-serif font-bold text-gray-900 text-center mb-8">
          Send Invitations
        </h1>
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold">Guests</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {guests.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No guests found. Add guests first, then generate QR codes.
              </div>
            )}
            {guests.map((guest) => (
              <div
                key={guest.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-800">{guest.name}</p>
                  <p className="text-sm text-gray-500">{guest.phone || 'No phone'}</p>
                  {guest.invitationCard ? (
                    <span className="text-xs text-green-600">✓ QR ready</span>
                  ) : (
                    <span className="text-xs text-amber-600">⚠ No QR</span>
                  )}
                </div>
                <div>
                  <SendButton guestId={guest.id} eventId={eventId} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}