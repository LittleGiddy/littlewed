import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';
import { 
  Calendar, MapPin, Users, Smartphone, CheckCircle, Clock, ArrowLeft, 
  Hash, MessageCircle, Phone, User, Users as UsersIcon, 
  UserCheck, UserPlus, UserX, UserCog, PartyPopper,
  TrendingUp, TrendingDown, Minus, Award, Star
} from 'lucide-react';
import { format } from 'date-fns';

interface Guest {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  cardNumber: string | null;
  checkedIn: boolean;
  checkInCount: number;
  attending: string;
  createdAt: Date;
  routingChannel: string;
  guestType: string | null;
  guestCount: number | null;
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-center text-gray-500">Please log in to view this event.</p>
      </div>
    );
  }

  const { id } = await params;
  const tenantId = (session.user as { tenantId?: string }).tenantId;

  const event = await prisma.event.findFirst({
    where: { id, tenantId },
    include: {
      guests: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!event) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Event Not Found</h1>
          <p className="text-gray-500">This event doesn't exist or you don't have access to it.</p>
          <Link href="/dashboard" className="inline-block mt-4 text-[#0D4B4B] font-semibold hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const guests = event.guests as Guest[];
  const totalGuests = guests.length;
  const checkedInCount = guests.filter(g => g.checkedIn).length;
  const rsvpYesCount = guests.filter(g => g.attending === 'yes').length;
  const guestsWithPhone = guests.filter(g => g.phone).length;
  const guestsWithCard = guests.filter(g => g.cardNumber).length;
  const whatsappCount = guests.filter(g => g.routingChannel === 'whatsapp').length;
  const doubleCount = guests.filter(g => g.guestType?.toUpperCase() === 'DOUBLE').length;
  const familiaCount = guests.filter(g => g.guestType?.toUpperCase() === 'FAMILIA').length;
  const wakweCount = guests.filter(g => g.guestType?.toUpperCase() === 'WAKWE').length;
  const singleCount = guests.filter(g => g.guestType?.toUpperCase() === 'SINGLE' || !g.guestType).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#0D4B4B] transition mb-6"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
        <h1 className="font-serif text-3xl font-black text-gray-900">{event.name}</h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar size={16} className="text-[#0D4B4B]" />
            {format(new Date(event.date), 'PPP')}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={16} className="text-[#0D4B4B]" />
            {event.venue}
          </span>
        </div>
        {event.address && <p className="text-sm text-gray-400 mt-1">{event.address}</p>}
      </div>

      {/* ─── Stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-3 md:p-4 text-center shadow-sm">
          <p className="text-xl md:text-2xl font-bold text-gray-900">{totalGuests}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Total Guests</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 md:p-4 text-center shadow-sm">
          <p className="text-xl md:text-2xl font-bold text-green-600">{checkedInCount}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Checked In</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 md:p-4 text-center shadow-sm">
          <p className="text-xl md:text-2xl font-bold text-[#0D4B4B]">{guestsWithPhone}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">With Phone</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 md:p-4 text-center shadow-sm">
          <p className="text-xl md:text-2xl font-bold text-amber-600">{guestsWithCard}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">With Card</p>
        </div>
      </div>

      {/* ─── Guest List ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-gray-800">Guest List</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                <User size={12} /> {singleCount}
              </span>
              <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                <UsersIcon size={12} /> {doubleCount}
              </span>
              <span className="flex items-center gap-1 text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                <UsersIcon size={12} /> {familiaCount}
              </span>
              <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                <UsersIcon size={12} /> {wakweCount}
              </span>
              <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <MessageCircle size={12} /> {whatsappCount}
              </span>
            </div>
          </div>
          <span className="text-xs font-medium text-gray-400">{totalGuests} guests</span>
        </div>

        {guests.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p>No guests added yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Card</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {guests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-gray-50 transition">
                    <td className="px-3 md:px-4 py-3">
                      <div className="font-medium text-gray-800">
                        {guest.title ? `${guest.title} ${guest.name}` : guest.name}
                      </div>
                      {guest.phone && (
                        <div className="text-xs text-gray-400 font-mono">{guest.phone}</div>
                      )}
                    </td>
                    <td className="px-3 md:px-4 py-3">
                      {guest.cardNumber ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-[#0D4B4B] bg-[rgba(13,75,75,0.08)] px-2 py-1 rounded-lg">
                          <Hash size={12} />
                          {guest.cardNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 md:px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${
                        guest.routingChannel === 'whatsapp'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {guest.routingChannel === 'whatsapp' ? (
                          <MessageCircle size={12} />
                        ) : (
                          <Phone size={12} />
                        )}
                        {guest.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                      </span>
                    </td>
                    <td className="px-3 md:px-4 py-3">
                      {guest.guestType ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg ${
                          guest.guestType.toUpperCase() === 'DOUBLE'
                            ? 'bg-purple-100 text-purple-700'
                            : ['FAMILIA', 'WAKWE'].includes(guest.guestType.toUpperCase())
                              ? 'bg-teal-100 text-teal-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}>
                          {['FAMILIA', 'WAKWE'].includes(guest.guestType.toUpperCase()) ? (
                            <UsersIcon size={13} />
                          ) : guest.guestType.toUpperCase() === 'DOUBLE' ? (
                            <UsersIcon size={13} />
                          ) : (
                            <User size={13} />
                          )}
                          {(guest.guestType.toUpperCase() === 'FAMILIA' || guest.guestType.toUpperCase() === 'WAKWE')
                            ? `${guest.guestType} ${guest.guestCount || ''}`.trim()
                            : guest.guestType}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 md:px-4 py-3">
                      {guest.checkedIn ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-lg">
                          <CheckCircle size={12} /> 
                          {guest.checkInCount > 1 ? `Checked In (${guest.checkInCount}x)` : 'Checked In'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}