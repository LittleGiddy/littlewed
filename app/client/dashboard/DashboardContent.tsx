'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, Plus, Coins, Upload, Palette, Send,
  ChevronRight, Grid3x3, Eye, CalendarDays, UserCheck,
  CheckCircle, MapPin, Download, Trash2, ArrowUpRight, Clock,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';
import RequestCreditsButton from '@/app/components/RequestCreditsButton';

interface DashboardContentProps {
  firstName: string;
  credits: number;
  totalGuests: number;
  checkedIn: number;
  events: {
    id: string;
    name: string;
    date: string;
    venue: string;
    status: string;
    _count: { guests: number };
  }[];
  newEventUrl: string;
}

const carouselImages = [
  {
    id: 1,
    src: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=900&h=500&fit=crop',
    title: 'Plan the Perfect Wedding',
    subtitle: 'Guest lists, invitations, and check-ins, all in one place.',
  },
  {
    id: 2,
    src: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=900&h=500&fit=crop',
    title: 'Effortless Guest Management',
    subtitle: 'Track RSVPs and check in guests instantly with QR codes.',
  },
  {
    id: 3,
    src: '/dashimg.jpg',
    title: 'Beautiful Invitation Cards',
    subtitle: 'Design custom cards and send via WhatsApp or SMS.',
  },
];

function EventCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goTo = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 3000);
  };

  return (
    <div className="relative w-full h-56 sm:h-64 rounded-[28px] overflow-hidden shadow-lg shadow-black/10">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <Image
            src={carouselImages[currentIndex].src}
            alt={carouselImages[currentIndex].title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-white leading-tight">
              {carouselImages[currentIndex].title}
            </h3>
            <p className="text-xs sm:text-sm text-white/85 mt-1 max-w-[85%]">
              {carouselImages[currentIndex].subtitle}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute top-4 right-4 flex gap-1.5 z-10">
        {carouselImages.map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function CompactDeleteButton({ eventId }: { eventId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirmToast({
      title: 'Delete this event?',
      message: 'This action cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to delete event');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors active:scale-90"
    >
      <Trash2 size={15} />
    </button>
  );
}

export default function DashboardContent({
  firstName,
  credits,
  totalGuests,
  checkedIn,
  events,
  newEventUrl,
}: DashboardContentProps) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    fetch('/api/credits/pending', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setHasPending(!!data.pending))
      .catch(() => {});
  }, []);

  const stats = [
    { label: 'Credits', value: credits, icon: Coins, color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5', ring: 'ring-[#0D4B4B]/10', isCredits: true },
    { label: 'Total Guests', value: totalGuests, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100', isCredits: false },
    { label: 'Checked In', value: checkedIn, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50', ring: 'ring-green-100', isCredits: false },
    { label: 'Events', value: events.length, icon: CalendarDays, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100', isCredits: false },
  ];

  const categories = [
    { id: 'all', label: 'All', icon: Grid3x3 },
    { id: 'upcoming', label: 'Upcoming', icon: Calendar },
    { id: 'live', label: 'Live', icon: Eye },
    { id: 'completed', label: 'Completed', icon: CheckCircle },
  ];

  const quickActions = [
    { label: 'New Event', sub: 'Start planning', icon: Plus, href: newEventUrl, color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5' },
    { label: 'Import Guests', sub: 'From a file', icon: Upload, href: '/client/guests/import/select-event', color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Design Card', sub: 'Custom invites', icon: Palette, href: '/client/invitations/design/select-event', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Send Invites', sub: 'WhatsApp / SMS', icon: Send, href: '/client/invitations/send/select-event', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Backup Guests', sub: 'Export data', icon: Download, href: '/client/guests/backup', color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  const eventColors = ['bg-[#0D4B4B]', 'bg-green-600', 'bg-amber-600'];

  const now = new Date();
  const liveEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // next 24h window

  // "Live" = event happening at the current time, i.e. whose date falls
  // within the next 24 hours. Uses the event date so it reflects the real
  // event window rather than the (rarely written) status flag.
  const isLiveNow = (event: { date: string }) => {
    const d = event.date ? new Date(event.date).getTime() : NaN;
    return !Number.isNaN(d) && d >= now.getTime() && d <= liveEnd.getTime();
  };

  const filteredEvents = events.filter((event) => {
    switch (activeCategory) {
      case 'upcoming':
        return event.status === 'ACTIVE' || event.status === 'DRAFT';
      case 'live':
        return isLiveNow(event);
      case 'completed':
        return event.status === 'EXPIRED' || event.status === 'ARCHIVED';
      default:
        return true;
    }
  });

  const categoryCounts = {
    all: events.length,
    upcoming: events.filter((e) => e.status === 'ACTIVE' || e.status === 'DRAFT').length,
    live: events.filter((e) => isLiveNow(e)).length,
    completed: events.filter((e) => e.status === 'EXPIRED' || e.status === 'ARCHIVED').length,
  };

  const featuredEvents = filteredEvents.slice(0, 6).map((event, index) => {
    const d = new Date(event.date);
    const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
      DRAFT: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
      ACTIVE: { label: 'Upcoming', color: 'text-blue-600', bg: 'bg-blue-50' },
      LIVE: { label: 'Live', color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5' },
      EXPIRED: { label: 'Completed', color: 'text-gray-500', bg: 'bg-gray-50' },
      ARCHIVED: { label: 'Archived', color: 'text-gray-400', bg: 'bg-gray-50' },
    };
    return {
      ...event,
      accentColor: eventColors[index % eventColors.length],
      day: d.getDate(),
      month: d.toLocaleString('default', { month: 'short' }),
      weekday: d.toLocaleString('default', { weekday: 'short' }),
      guestCount: event._count.guests,
      statusInfo: statusConfig[event.status] || statusConfig.DRAFT,
    };
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 22, stiffness: 100 } },
  };

  return (
    <motion.div
      className="min-h-screen pb-4"
      initial="hidden"
      animate={isLoaded ? 'visible' : 'hidden'}
      variants={containerVariants}
    >
      <div className="max-w-lg mx-auto">
        {/* ─── Header ─── */}
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-medium tracking-wide text-gray-400">WELCOME BACK</p>
            <h1 className="font-serif text-2xl font-bold mt-0.5 text-gray-900">
              {firstName}
            </h1>
          </div>
        </motion.div>

        {/* ─── Carousel ─── */}
        <motion.div variants={itemVariants} className="mb-6">
          <EventCarousel />
        </motion.div>

        {/* ─── Pending Request Banner ─── */}
        {hasPending && (
          <motion.div variants={itemVariants} className="mb-4">
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <Clock size={18} className="text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800">Credit request pending</p>
                <p className="text-xs text-amber-600 mt-0.5">Waiting for admin to review your credit request.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Stats 2x2 Grid ─── */}
        <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3 mb-6">
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              whileTap={{ scale: 0.97 }}
              className="bg-white rounded-3xl p-4 flex flex-col justify-between shadow-[0_2px_10px_rgba(20,30,45,0.06)]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${stat.bg} ${stat.color} ring-1 ${stat.ring}`}>
                  <stat.icon size={18} />
                </div>
                {stat.isCredits && (
                  <RequestCreditsButton compact hasPending={hasPending} onRequestSent={() => window.location.reload()} />
                )}
              </div>
              <div>
                <p className="font-serif text-2xl font-bold text-gray-900">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
                <p className="text-xs font-medium mt-0.5 text-gray-400">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ─── Quick Actions ─── */}
        <motion.div variants={itemVariants} className="mb-6">
          <h2 className="font-serif text-lg font-bold mb-3 text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href}>
                <motion.div
                  whileTap={{ scale: 0.96 }}
                  className="bg-white rounded-3xl p-4 h-full flex flex-col justify-between shadow-[0_2px_10px_rgba(20,30,45,0.06)]"
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${action.bg} ${action.color}`}>
                    <action.icon size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{action.label}</p>
                    <p className="text-[11px] mt-0.5 text-gray-400">{action.sub}</p>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* ─── Category Tabs ─── */}
        <motion.div variants={itemVariants} className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {categories.map((category) => {
              const isActive = activeCategory === category.id;
              const count = categoryCounts[category.id as keyof typeof categoryCounts];
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[#0D4B4B] text-white'
                      : 'bg-white text-gray-400 shadow-[0_2px_8px_rgba(20,30,45,0.05)]'
                  }`}
                >
                  <category.icon size={14} />
                  {category.label}
                  <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ─── Featured Events ─── */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-bold text-gray-900">
              {activeCategory === 'all' ? 'Your Events' : categories.find((c) => c.id === activeCategory)?.label + ' Events'}
            </h2>
            <Link
              href="/client/events"
              className="flex items-center gap-0.5 text-xs font-bold text-[#0D4B4B]"
            >
              See all <ChevronRight size={13} />
            </Link>
          </div>

          {featuredEvents.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center shadow-[0_2px_10px_rgba(20,30,45,0.06)]">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-[#0D4B4B]/5">
                <Calendar className="w-8 h-8 text-[#0D4B4B]" />
              </div>
              <h3 className="font-serif text-lg font-bold text-gray-900">
                {activeCategory === 'all' ? 'No events yet' : `No ${activeCategory} events`}
              </h3>
              <p className="text-sm mt-1 text-gray-400">
                {activeCategory === 'all'
                  ? 'Create your first event to get started.'
                  : 'Events will appear here when they match this filter.'}
              </p>
              {activeCategory === 'all' && (
                <Link
                  href={newEventUrl}
                  className="inline-flex items-center gap-2 mt-5 px-6 py-3 bg-[#0D4B4B] text-white text-sm font-bold rounded-2xl"
                >
                  <Plus size={16} /> Create Event
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {featuredEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="bg-white rounded-3xl overflow-hidden shadow-[0_2px_10px_rgba(20,30,45,0.06)]"
                >
                  <Link href={`/client/events/${event.id}`} className="block">
                    <div className="flex items-stretch">
                      <div className={`w-20 flex flex-col items-center justify-center text-white shrink-0 ${event.accentColor}`}>
                        <span className="text-[10px] font-bold uppercase opacity-80">{event.weekday}</span>
                        <span className="font-serif text-2xl font-bold leading-none mt-0.5">{event.day}</span>
                        <span className="text-[10px] font-bold uppercase opacity-80 mt-0.5">{event.month}</span>
                      </div>

                      <div className="flex-1 min-w-0 p-4 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm truncate text-gray-900">{event.name}</h3>
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin size={12} className="text-gray-400" />
                            <span className="text-xs truncate text-gray-400">{event.venue}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#0D4B4B]/5 text-[#0D4B4B] ring-1 ring-[#0D4B4B]/10">
                              {event.guestCount} guests
                            </span>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${event.statusInfo.bg} ${event.statusInfo.color}`}>
                              {event.statusInfo.label}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-2 shrink-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 text-[#0D4B4B]">
                            <ArrowUpRight size={15} />
                          </div>
                          <CompactDeleteButton eventId={event.id} />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
