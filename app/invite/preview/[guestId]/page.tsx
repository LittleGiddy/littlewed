import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CheckCircle } from 'lucide-react';

export default async function PreviewPage({ params }: { params: Promise<{ guestId: string }> }) {
  const { guestId } = await params;
  const session = await getServerSession(authOptions);

  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: {
      event: {
        include: {
          tenant: true,
        },
      },
    },
  });

  if (!guest) notFound();

  const isTestMode = guest.event.tenant.testMode;
  const checkInUrl = `${process.env.NEXTAUTH_URL}/api/check-in?guestId=${guest.id}`;
  const qrCodeDataUrl = await QRCode.toDataURL(checkInUrl);

  const templateUrl = guest.event.templateCardUrl || guest.event.tenant.templateCardUrl;
  const qrX = guest.event.qrPlacementX ?? guest.event.tenant.qrPlacementX ?? 50;
  const qrY = guest.event.qrPlacementY ?? guest.event.tenant.qrPlacementY ?? 50;
  const qrSize = guest.event.qrSize ?? guest.event.tenant.qrSize ?? 150;
  const includeName = guest.event.includeName ?? false;
  const nameX = guest.event.namePlacementX ?? 50;
  const nameY = guest.event.namePlacementY ?? 50;
  const nameFontSize = guest.event.nameFontSize ?? 24;
  const nameFontColor = guest.event.nameFontColor ?? '#000000';

  const checkedIn = guest.checkedIn;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="relative max-w-md w-full">
        {/* Card */}
        <div className="relative rounded-2xl overflow-hidden shadow-lg bg-white border border-gray-200">
          {templateUrl ? (
            <div className="relative">
              <img src={templateUrl} alt="Invitation" className="w-full h-auto" />
              {/* QR Code overlay */}
              <div
                className="absolute"
                style={{
                  left: `${qrX}%`,
                  top: `${qrY}%`,
                  width: qrSize,
                  height: qrSize,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <img src={qrCodeDataUrl} alt="QR Code" className="w-full h-full object-contain" />
              </div>
              {/* Name overlay */}
              {includeName && (
                <div
                  className="absolute font-bold text-center"
                  style={{
                    left: `${nameX}%`,
                    top: `${nameY}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: nameFontSize,
                    color: nameFontColor,
                    textShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  {guest.name}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No card template uploaded. Please design your invitation card first.
            </div>
          )}

          {/* Status badge */}
          {checkedIn && (
            <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <CheckCircle size={14} /> Checked In
            </div>
          )}
        </div>

        {/* Footer with test controls */}
        <div className="mt-4 text-center">
          {isTestMode ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-700 font-medium mb-2">🧪 Test Mode – Preview Only</p>
              {checkedIn ? (
                <span className="text-sm text-green-700 font-semibold">✅ Guest is checked in</span>
              ) : (
                <form action={`/api/check-in?guestId=${guest.id}`} method="POST">
                  <button
                    type="submit"
                    className="bg-[#0D4F4F] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#0A3D3D] transition"
                  >
                    🎯 Test Check‑In
                  </button>
                </form>
              )}
              <p className="text-[10px] text-amber-600 mt-2">This guest will be marked as checked in (simulated)</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Scan this QR code at the venue to check in.</p>
          )}
        </div>
      </div>
    </div>
  );
}