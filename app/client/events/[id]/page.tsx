import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Calendar, MapPin, Users, QrCode, MessageCircle, Phone, ArrowRight, ArrowLeft, Upload, Plus, Palette, Send, Smartphone } from 'lucide-react';
import { format } from 'date-fns';
import { authOptions } from '@/lib/auth';


export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    redirect('/login');
  }

  const tenantId = (session.user as any).tenantId;
  const { id } = await params;

  const event = await prisma.event.findFirst({
    where: { id, tenantId },
    include: { guests: true },
  });

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="text-5xl mb-3">🔍</div>
          <h1 className="font-serif text-2xl font-bold text-gray-800 mb-2">Event Not Found</h1>
          <p className="text-gray-500 text-sm mb-5">This event doesn't exist or you don't have access to it.</p>
          <Link
            href="/client/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white text-sm font-bold rounded-xl hover:shadow-md transition"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const checkedInCount = event.guests.filter(g => g.checkedIn).length;
  const whatsappCount = event.guests.filter(g => g.routingChannel === 'whatsapp').length;
  const smsCount = event.guests.filter(g => g.routingChannel === 'sms').length;
  const attendingCount = event.guests.filter(g => g.attending === 'yes').length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/client/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)] mb-6"
      >
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>

      {/* Event header */}
      <div className="mb-7">
        <h1 className="font-serif text-3xl md:text-4xl font-black text-gray-900 leading-tight tracking-tight mb-3">
          {event.name}
        </h1>
        <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-1">
          <div className="flex items-center gap-1.5">
            <Calendar size={16} className="text-[#0D4F4F]" />
            {format(new Date(event.date), 'PPP')}
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={16} className="text-[#0D4F4F]" />
            {event.venue}
          </div>
        </div>
        <p className="text-sm text-gray-400">{event.address}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        <div className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition">
          <div className="w-9 h-9 rounded-xl bg-[rgba(13,79,79,0.08)] flex items-center justify-center mx-auto mb-2 text-[#0D4F4F]">
            <Users size={18} />
          </div>
          <div className="font-serif text-2xl font-black text-gray-800">{event.guests.length}</div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Guests</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition">
          <div className="w-9 h-9 rounded-xl bg-[#EDFAF4] flex items-center justify-center mx-auto mb-2 text-[#1A7A4A]">
            <Smartphone size={18} />
          </div>
          <div className="font-serif text-2xl font-black text-gray-800">{checkedInCount}</div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Checked In</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition">
          <div className="w-9 h-9 rounded-xl bg-[#EAF4F4] flex items-center justify-center mx-auto mb-2 text-[#0D4F4F]">
            <MessageCircle size={18} />
          </div>
          <div className="font-serif text-2xl font-black text-gray-800">{whatsappCount}</div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">WhatsApp</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition">
          <div className="w-9 h-9 rounded-xl bg-[#FEF6EC] flex items-center justify-center mx-auto mb-2 text-[#C07A20]">
            <Phone size={18} />
          </div>
          <div className="font-serif text-2xl font-black text-gray-800">{smsCount}</div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">SMS</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
        <Link href={`/client/invitations/send/${event.id}`} className="col-span-full bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white text-center py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2">
          <Send size={15} /> Send Invitations
        </Link>
        <Link href={`/client/guests/import/${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
          <Upload size={14} /> Import Guests
        </Link>
        <Link href={`/client/guests/add/${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
          <Plus size={14} /> Add Guest
        </Link>
        <Link href={`/client/invitations/design/${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
          <Palette size={14} /> Design Card
        </Link>
        <Link href={`/client/check-in?event=${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
          <QrCode size={14} /> Check-In
        </Link>
      </div>

      {/* Guest list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h2 className="font-serif text-lg font-extrabold text-gray-800">Guest List</h2>
          <span className="text-[11px] font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] px-2.5 py-1 rounded-full">
            {event.guests.length} guest{event.guests.length !== 1 ? 's' : ''}
          </span>
        </div>
        {event.guests.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <h3 className="font-serif text-lg font-bold text-gray-800 mb-1">No guests yet</h3>
            <p className="text-sm text-gray-400">Import a guest list or add guests manually to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {event.guests.map(guest => (
              <div key={guest.id} className="px-5 py-3 flex justify-between items-center hover:bg-gray-50">
                <div>
                  <p className="font-semibold text-gray-800">{guest.name}</p>
                  {guest.phone && <p className="text-xs text-gray-500">{guest.phone}</p>}
                  <div className="flex items-center gap-1 mt-1">
                    {guest.routingChannel === 'whatsapp' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.07)] px-2 py-0.5 rounded-full">
                        <MessageCircle size={10} /> WhatsApp
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Phone size={10} /> SMS
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  {guest.checkedIn ? (
                    <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">✓ Checked in</span>
                  ) : (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}