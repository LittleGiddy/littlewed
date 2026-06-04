'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, MapPin, Users, QrCode, Smartphone, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface Guest {
  id: string;
  name: string;
  phone: string;
  attending: string;
  checkedIn: boolean;
  routingChannel: string;
}

interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  address: string;
  guests: Guest[];
}

export default function EventDetailClient({ event }: { event: Event }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('guests');

  const checkedInCount = event.guests.filter(g => g.checkedIn).length;
  const rsvpYesCount = event.guests.filter(g => g.attending === 'yes').length;
  const whatsappCount = event.guests.filter(g => g.routingChannel === 'whatsapp').length;
  const smsCount = event.guests.filter(g => g.routingChannel === 'sms').length;

  const tabs = [
    { id: 'guests', label: 'Guests', icon: Users },
    { id: 'invitations', label: 'Invite', icon: QrCode },
    { id: 'checkin', label: 'Check-in', icon: Smartphone },
    { id: 'stats', label: 'Stats', icon: TrendingUp },
  ];

  return (
    <div className="pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <div className="flex items-center gap-2 text-gray-600 mt-1">
          <Calendar className="w-4 h-4" />
          <span>{format(new Date(event.date), 'PPP')}</span>
          <MapPin className="w-4 h-4 ml-2" />
          <span>{event.venue}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{event.address}</p>
      </div>

      <div className="flex gap-2 border-b mb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'guests' && (
        <div>
          <div className="flex gap-2 mb-4">
            <Link href={`/client/guests/import/${event.id}`} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm">
              Import CSV
            </Link>
            <Link href={`/client/guests/add/${event.id}`} className="bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm">
              Add Manually
            </Link>
          </div>
          <div className="space-y-3">
            {event.guests.map(guest => (
              <div key={guest.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{guest.name}</p>
                  <p className="text-sm text-gray-500">{guest.phone}</p>
                  <p className="text-xs text-gray-400">{guest.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm ${guest.checkedIn ? 'text-green-600' : 'text-gray-400'}`}>
                    {guest.checkedIn ? '✓ Checked in' : 'Pending'}
                  </p>
                </div>
              </div>
            ))}
            {event.guests.length === 0 && (
              <div className="text-center py-8 text-gray-500">No guests yet. Import or add guests.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'invitations' && (
        <div className="space-y-4">
          <Link href={`/client/invitations/design/${event.id}`} className="block bg-purple-600 text-white text-center py-2 rounded-xl">
            Design Invitation Template
          </Link>
          <Link href={`/client/invitations/send/${event.id}`} className="block bg-green-600 text-white text-center py-2 rounded-xl">
            Send Invitations
          </Link>
          <p className="text-sm text-gray-500 text-center">WhatsApp: {whatsappCount} guests | SMS: {smsCount} guests</p>
        </div>
      )}

      {activeTab === 'checkin' && (
        <div>
          <Link href={`/client/check-in?event=${event.id}`} className="bg-blue-600 text-white px-4 py-2 rounded-xl inline-block">
            Open Check-in Scanner
          </Link>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <p>Total guests: {event.guests.length}</p>
          <p>RSVP confirmed: {rsvpYesCount}</p>
          <p>Checked in: {checkedInCount}</p>
          <p>WhatsApp guests: {whatsappCount}</p>
          <p>SMS guests: {smsCount}</p>
        </div>
      )}
    </div>
  );
}