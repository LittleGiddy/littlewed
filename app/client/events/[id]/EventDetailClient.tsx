'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, QrCode, Smartphone, TrendingUp, Plus, Mail, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

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
  const whatsappCount = event.guests.filter(g => g.routingChannel === 'whatsapp').length;
  const smsCount = event.guests.filter(g => g.routingChannel === 'sms').length;

  const tabs = [
    { id: 'guests', label: 'Guests', icon: Users, count: event.guests.length },
    { id: 'invitations', label: 'Invite', icon: QrCode },
    { id: 'checkin', label: 'Check-in', icon: Smartphone },
    { id: 'stats', label: 'Stats', icon: TrendingUp },
  ];

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${event.id}`);
    toast.success('Invitation link copied!');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
        <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(event.date).toLocaleDateString()}</span>
          <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {event.venue}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{event.address}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b mb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && <span className="ml-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'guests' && (
            <div>
              <div className="flex gap-2 mb-4">
                <Link href={`/client/guests/import/${event.id}`} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Import CSV
                </Link>
                <Link href={`/client/guests/add/${event.id}`} className="bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add Manually
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
                        {guest.checkedIn ? <CheckCircle className="w-5 h-5 text-green-600" /> : 'Pending'}
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
                Design Invitation Card
              </Link>
              <Link href={`/client/invitations/send/${event.id}`} className="block bg-green-600 text-white text-center py-2 rounded-xl">
                Send Invitations
              </Link>
              <button onClick={copyInviteLink} className="block w-full bg-indigo-100 text-indigo-700 text-center py-2 rounded-xl">
                Copy Public Invite Link
              </button>
              <p className="text-sm text-gray-500 text-center">WhatsApp: {whatsappCount} guests | SMS: {smsCount} guests</p>
            </div>
          )}

          {activeTab === 'checkin' && (
            <div className="text-center">
              <Link href={`/client/check-in?event=${event.id}`} className="bg-blue-600 text-white px-4 py-2 rounded-xl inline-block">
                Open Check-in Scanner
              </Link>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="bg-white rounded-xl shadow-sm p-5 space-y-2">
              <p>Total guests: {event.guests.length}</p>
              <p>Checked in: {checkedInCount}</p>
              <p>WhatsApp guests: {whatsappCount}</p>
              <p>SMS guests: {smsCount}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}