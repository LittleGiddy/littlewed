import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft, Calendar, MapPin, PartyPopper, Heart, CheckCircle,
  XCircle, CircleHelp, MessageSquareHeart,
} from 'lucide-react';

interface RsvpRow {
  id: string;
  guestName: string;
  status: string;
  createdAt: Date;
}

interface WishRow {
  id: string;
  guestName: string;
  message: string;
  attending: string | null;
  createdAt: Date;
}

export default async function EventRsvpsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-500">
        Please log in to view this event.
      </div>
    );
  }

  const role = (session.user as { role?: string } | undefined)?.role;
  const tenantId = (session.user as { tenantId?: string } | undefined)?.tenantId;
  if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') redirect('/login');

  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    include: {
      rsvps: {
        select: { id: true, guestId: true, guestName: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      },
      wishes: {
        select: { id: true, guestId: true, guestName: true, message: true, attending: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      },
    },
  });

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Event Not Found</h1>
          <p className="text-gray-500 mb-4">This event doesn&apos;t exist or you don&apos;t have access to it.</p>
          <Link href="/client/dashboard" className="inline-block text-[#0D4B4B] font-semibold hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const rsvps = event.rsvps as RsvpRow[];
  const wishes = event.wishes as WishRow[];

  const attendingCount = rsvps.filter(r => r.status === 'yes').length;
  const declinedCount = rsvps.filter(r => r.status === 'no').length;
  const maybeCount = rsvps.filter(r => r.status === 'pending').length;

  const statusChip = (status: string) => {
    if (status === 'yes') return { label: 'Attending', cls: 'bg-green-50 text-green-700 ring-green-200', Icon: CheckCircle };
    if (status === 'no') return { label: 'Declined', cls: 'bg-red-50 text-red-600 ring-red-200', Icon: XCircle };
    return { label: 'Maybe', cls: 'bg-amber-50 text-amber-700 ring-amber-200', Icon: CircleHelp };
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* ─── Header ─── */}
      <div className="mb-6">
        <Link
          href={`/client/events/${eventId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#0D4B4B] transition mb-4"
        >
          <ArrowLeft size={16} /> Back to event
        </Link>
        <h1 className="font-serif text-3xl sm:text-4xl font-black text-gray-900 leading-tight">RSVPs &amp; Wishes</h1>
        <p className="text-sm text-gray-400 mt-1">{event.name}</p>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar size={15} className="text-[#0D4B4B]" />
            {format(new Date(event.date), 'PPP')}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={15} className="text-[#0D4B4B]" />
            {event.venue}
          </span>
        </div>
      </div>

      {/* ─── Stats ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{rsvps.length}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Total Responses</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-green-600">{attendingCount}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Attending</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-red-500">{declinedCount}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Declined</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-amber-500">{maybeCount}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Maybe</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-[#0D4B4B]">{wishes.length}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Wishes</p>
        </div>
      </div>

      {rsvps.length === 0 && wishes.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400">
          <MessageSquareHeart size={40} className="mx-auto mb-3 opacity-30" />
          <p>No RSVPs or wishes yet.</p>
          <p className="text-sm">Once guests open their invitation and respond, their replies will appear here.</p>
        </div>
      )}

      {/* ─── RSVP list ─── */}
      {rsvps.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <PartyPopper size={18} />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800">RSVP Responses</p>
                <p className="text-xs text-gray-400">
                  {rsvps.length} response{rsvps.length !== 1 ? 's' : ''} · {attendingCount} attending
                </p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
            {rsvps.map(r => {
              const chip = statusChip(r.status);
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{r.guestName}</p>
                    <p className="text-[11px] text-gray-400">
                      {format(new Date(r.createdAt), 'MMM d, yyyy · h:mm a')} · {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full ring-1 shrink-0 ${chip.cls}`}>
                    <chip.Icon size={13} /> {chip.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Wishes list ─── */}
      {wishes.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0D4B4B]/[0.07] text-[#0D4B4B] flex items-center justify-center shrink-0">
                <Heart size={18} />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800">Guest Wishes</p>
                <p className="text-xs text-gray-400">{wishes.length} wish{wishes.length !== 1 ? 'es' : ''}</p>
              </div>
            </div>
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            {wishes.map(w => (
              <div key={w.id} className="px-5 py-4 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-bold text-gray-800 truncate">{w.guestName}</p>
                  <span className="flex items-center gap-2 shrink-0">
                    {w.attending && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${statusChip(w.attending).cls}`}>
                        {statusChip(w.attending).label}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-300">{formatDistanceToNow(new Date(w.createdAt), { addSuffix: true })}</span>
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{w.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}