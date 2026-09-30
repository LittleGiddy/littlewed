'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, Plus, Coins, Upload, Palette, Send,
  ChevronRight, Grid3x3, Eye, CalendarDays, UserCheck,
  CheckCircle, MapPin, Download, Trash2, ArrowUpRight, Clock, QrCode, PartyPopper,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';
import RequestCreditsButton from '@/app/components/RequestCreditsButton';
import AppPageHeader from '@/components/ui/AppPageHeader';
import AppEmptyState from '@/components/ui/AppEmptyState';
import AppChip from '@/components/ui/AppChip';
import AppSegmentedControl from '@/components/ui/AppSegmentedControl';
import { buttonClasses } from '@/components/ui/AppButton';
import { useReducedMotion } from '@/lib/motion';

interface DashboardContentProps {
  firstName: string;
  credits: number;
  totalGuests: number;
  checkedIn: number;
  responded: number;
  events: {
    id: string;
    name: string;
    date: string;
    venue: string;
    status: string;
    respondedCount: number;
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
            <h3 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">
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
      className="w-9 h-9 rounded-full bg-danger-soft flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-danger transition-colors active:scale-90"
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
  responded,
  events,
  newEventUrl,
}: DashboardContentProps) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [hasPending, setHasPending] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    fetch('/api/credits/pending', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setHasPending(!!data.pending))
      .catch(() => {});
  }, []);

  // Restrained palette: teal carries the brand, green only means "good",
  // amber only means "needs attention". No decorative rainbow.
  const stats = [
    { label: 'Credits', value: credits, icon: Coins, tone: 'brand', isCredits: true },
    { label: 'Total Guests', value: totalGuests, icon: Users, tone: 'brand', isCredits: false },
    { label: 'RSVPs', value: responded, icon: PartyPopper, tone: 'brand', isCredits: false },
    { label: 'Checked In', value: checkedIn, icon: UserCheck, tone: 'success', isCredits: false },
    { label: 'Events', value: events.length, icon: CalendarDays, tone: 'brand', isCredits: false },
  ] as const;

  const statTones = {
    brand: { tile: 'bg-brand-soft text-brand', value: 'text-gray-900' },
    success: { tile: 'bg-success-soft text-success', value: 'text-gray-900' },
  } as const;

  const categories = [
    { id: 'all', label: 'All', icon: Grid3x3 },
    { id: 'upcoming', label: 'Upcoming', icon: Calendar },
    { id: 'live', label: 'Live', icon: Eye },
    { id: 'completed', label: 'Completed', icon: CheckCircle },
  ];

  const quickActions = [
    { label: 'New Event', sub: 'Start planning', icon: Plus, href: newEventUrl },
    { label: 'Import Guests', sub: 'From a file', icon: Upload, href: '/client/guests/import/select-event' },
    { label: 'Design Card', sub: 'Custom invites', icon: Palette, href: '/client/invitations/design/select-event' },
    { label: 'Send Invites', sub: 'WhatsApp / SMS', icon: Send, href: '/client/invitations/send/select-event' },
    { label: 'Backup Guests', sub: 'Export data', icon: Download, href: '/client/guests/backup' },
    { label: 'Check-in', sub: 'Scan guests in', icon: QrCode, href: '/client/check-in/select-event' },
  ];

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

  const featuredEvents = filteredEvents.slice(0, 6).map((event) => {
    const d = new Date(event.date);
    const statusConfig: Record<string, { label: string; tone: 'neutral' | 'brand' | 'success' | 'warn' }> = {
      DRAFT: { label: 'Draft', tone: 'neutral' },
      ACTIVE: { label: 'Upcoming', tone: 'brand' },
      LIVE: { label: 'Live', tone: 'success' },
      EXPIRED: { label: 'Completed', tone: 'neutral' },
      ARCHIVED: { label: 'Archived', tone: 'neutral' },
    };
    return {
      ...event,
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
      className="pb-4"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="max-w-2xl lg:max-w-5xl mx-auto">
        {/* ─── Header ─── */}
        <motion.div variants={itemVariants} className="mb-5">
          <AppPageHeader
            eyebrow="Welcome back"
            title={firstName}
            description="Here is how your weddings are looking today."
          />
        </motion.div>

        {/* ─── Carousel ─── */}
        <motion.div variants={itemVariants} className="mb-6">
          <EventCarousel />
        </motion.div>

        {/* ─── Pending Request Banner ─── */}
        {hasPending && (
          <motion.div variants={itemVariants} className="mb-4">
            <div className="flex items-start gap-3 bg-warn-soft border border-warn-border rounded-card px-4 py-3">
              <Clock size={18} className="text-warn shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-warn">Credit request pending</p>
                <p className="text-xs text-warn/80 mt-0.5">Waiting for admin to review your credit request. Need it sooner? WhatsApp +255702529514.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Stats ─── */}
        <motion.div variants={containerVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              className="bg-white rounded-card border border-gray-200/80 shadow-elev-1 p-4 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`w-10 h-10 rounded-tap grid place-items-center shrink-0 ${statTones[stat.tone].tile}`}>
                  <stat.icon size={18} />
                </span>
                {stat.isCredits && (
                  <RequestCreditsButton compact hasPending={hasPending} onRequestSent={() => window.location.reload()} />
                )}
              </div>
              <div>
                <p className={`font-display text-2xl font-black ${statTones[stat.tone].value}`}>
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
                <p className="text-[11px] font-semibold mt-0.5 text-gray-400">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ─── Quick Actions ─── */}
        <motion.div variants={itemVariants} className="mb-6">
          <h2 className="font-display text-lg font-bold mb-3 text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href} className="no-underline">
                <motion.div
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                  className="bg-white rounded-card border border-gray-200/80 shadow-elev-1 p-4 h-full flex flex-col justify-between transition-colors duration-150 hover:border-brand/30 active:bg-gray-50"
                >
                  <span className="w-11 h-11 rounded-tap grid place-items-center mb-4 bg-brand-soft text-brand">
                    <action.icon size={20} />
                  </span>
                  <span className="block">
                    <span className="block text-sm font-bold text-gray-900">{action.label}</span>
                    <span className="block text-[11px] mt-0.5 text-gray-400">{action.sub}</span>
                  </span>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* ─── Category filter ─── */}
        <motion.div variants={itemVariants} className="mb-4">
          <AppSegmentedControl
            label="Filter events by status"
            value={activeCategory}
            onChange={(next) => setActiveCategory(next as typeof activeCategory)}
            options={categories.map((category) => ({
              value: category.id,
              label: category.label,
              icon: <category.icon size={14} />,
              badge: categoryCounts[category.id as keyof typeof categoryCounts],
            }))}
          />
        </motion.div>

        {/* ─── Featured Events ─── */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display text-lg font-bold text-gray-900">
              {activeCategory === 'all' ? 'Your Events' : `${categories.find((c) => c.id === activeCategory)?.label} Events`}
            </h2>
            <Link
              href="/client/events"
              className="flex items-center gap-0.5 text-xs font-bold text-brand no-underline"
            >
              See all <ChevronRight size={13} />
            </Link>
          </div>

          {featuredEvents.length === 0 ? (
            <div className="bg-white rounded-card border border-gray-200/80 shadow-elev-1">
              <AppEmptyState
                icon={<Calendar className="w-7 h-7" />}
                title={activeCategory === 'all' ? 'No events yet' : `No ${activeCategory} events`}
                description={
                  activeCategory === 'all'
                    ? 'Create your first event to start planning.'
                    : 'Events will appear here once they match this filter.'
                }
                action={
                  activeCategory === 'all' ? (
                    <Link href={newEventUrl} className={`${buttonClasses()} no-underline`}>
                      <Plus size={16} /> Create Event
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="space-y-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 sm:space-y-0">
              {featuredEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reducedMotion ? 0 : index * 0.05 }}
                  className="bg-white rounded-card border border-gray-200/80 shadow-elev-1 overflow-hidden"
                >
                  <Link href={`/client/events/${event.id}`} className="block no-underline">
                    <div className="flex items-stretch h-full">
                      <div className="w-[72px] flex flex-col items-center justify-center text-white shrink-0 bg-brand">
                        <span className="text-[10px] font-bold uppercase opacity-75">{event.weekday}</span>
                        <span className="font-display text-2xl font-black leading-none mt-0.5">{event.day}</span>
                        <span className="text-[10px] font-bold uppercase opacity-75 mt-0.5">{event.month}</span>
                      </div>

                      <div className="flex-1 min-w-0 p-4 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm truncate text-gray-900">{event.name}</h3>
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin size={12} className="text-gray-400 shrink-0" />
                            <span className="text-xs truncate text-gray-400">{event.venue}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <AppChip tone="brand">{event.guestCount} guests</AppChip>
                            {event.respondedCount > 0 && (
                              <AppChip tone="neutral">{event.respondedCount} RSVPs</AppChip>
                            )}
                            <AppChip tone={event.statusInfo.tone}>{event.statusInfo.label}</AppChip>
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-2 shrink-0">
                          <span className="w-9 h-9 rounded-full grid place-items-center bg-brand-soft text-brand">
                            <ArrowUpRight size={15} />
                          </span>
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
