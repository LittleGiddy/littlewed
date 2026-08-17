'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, Plus, Coins, Upload, Palette, Send,
  ChevronRight, Grid3x3, Eye, CalendarDays, UserCheck,
  CheckCircle, Sparkles, MapPin, Download, Trash2, ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import BuyCreditsButton from '@/app/components/BuyCreditsButton';

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
    _count: { guests: number };
  }[];
  newEventUrl: string;
}

// ─── Palette ─────────────────────────────────────────────────────────────
// Kept your teal/gold identity, but simplified to a flat "material" system:
// one accent color, one ink color, one muted color, cards on white.
const INK = '#0D1B1B';
const MUTED = '#7A8FA6';
const ACCENT = '#0D4F4F';
const SURFACE = '#F4F6F9';
const CARD = '#FFFFFF';

// ─── Hero Carousel ───────────────────────────────────────────────────────
const carouselImages = [
  {
    id: 1,
    src: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=900&h=500&fit=crop',
    title: 'Plan the Perfect Wedding',
    subtitle: 'Guest lists, invitations, and check-ins — all in one place.',
  },
  {
    id: 2,
    src: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=900&h=500&fit=crop',
    title: 'Effortless Guest Management',
    subtitle: 'Track RSVPs and check in guests instantly with QR codes.',
  },
  {
    id: 3,
    src: 'https://images.unsplash.com/photo-1532712932145-1d5fbe6cda9b?w=900&h=500&fit=crop',
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
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h3 className="font-serif text-2xl font-bold text-white leading-tight">
              {carouselImages[currentIndex].title}
            </h3>
            <p className="text-sm text-white/85 mt-1 max-w-[85%]">
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

// ─── Delete Event Button ─────────────────────────────────────────────────
function CompactDeleteButton({ eventId }: { eventId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this event? This action cannot be undone.')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        window.location.reload();
      } else {
        alert('Failed to delete event');
      }
    } catch {
      alert('Network error');
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

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const stats = [
    { label: 'Credits', value: credits, icon: Coins, tint: '#0D4F4F', tintBg: '#E6F0EE' },
    { label: 'Total Guests', value: totalGuests, icon: Users, tint: '#2563EB', tintBg: '#E8EFFD' },
    { label: 'Checked In', value: checkedIn, icon: UserCheck, tint: '#1A7A4A', tintBg: '#E7F6EC' },
    { label: 'Events', value: events.length, icon: CalendarDays, tint: '#C07A20', tintBg: '#FBF0E1' },
  ];

  const categories = [
    { id: 'all', label: 'All', icon: Grid3x3 },
    { id: 'upcoming', label: 'Upcoming', icon: Calendar },
    { id: 'live', label: 'Live', icon: Eye },
    { id: 'completed', label: 'Completed', icon: CheckCircle },
  ];

  const quickActions = [
    { label: 'New Event', sub: 'Start planning', icon: Plus, href: newEventUrl, tint: '#0D4F4F', tintBg: '#E6F0EE' },
    { label: 'Import Guests', sub: 'From a file', icon: Upload, href: '/client/guests/import/select-event', tint: '#1A7A4A', tintBg: '#E7F6EC' },
    { label: 'Design Card', sub: 'Custom invites', icon: Palette, href: '/client/invitations/design/select-event', tint: '#C07A20', tintBg: '#FBF0E1' },
    { label: 'Send Invites', sub: 'WhatsApp / SMS', icon: Send, href: '/client/invitations/send/select-event', tint: '#2563EB', tintBg: '#E8EFFD' },
    { label: 'Backup Guests', sub: 'Export data', icon: Download, href: '/client/guests/backup', tint: '#6B3FA0', tintBg: '#F0E9FA' },
  ];

  const featuredEvents = events.slice(0, 3).map((event, index) => {
    const d = new Date(event.date);
    const colors = ['#0D4F4F', '#1A7A4A', '#C07A20'];
    return {
      ...event,
      accentColor: colors[index % colors.length],
      day: d.getDate(),
      month: d.toLocaleString('default', { month: 'short' }),
      weekday: d.toLocaleString('default', { weekday: 'short' }),
      guestCount: event._count.guests,
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
      className="min-h-screen pb-10 font-sans"
      style={{ background: SURFACE }}
      initial="hidden"
      animate={isLoaded ? 'visible' : 'hidden'}
      variants={containerVariants}
    >
      <main className="max-w-lg mx-auto px-4 pt-5 pb-8">
        {/* ─── Header ─── */}
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-medium tracking-wide" style={{ color: MUTED }}>WELCOME BACK</p>
            <h1 className="font-serif text-2xl font-bold mt-0.5" style={{ color: INK }}>
              {firstName} 👋
            </h1>
          </div>
        
        </motion.div>

        {/* ─── Carousel ─── */}
        <motion.div variants={itemVariants} className="mb-6">
          <EventCarousel />
        </motion.div>

        {/* ─── Stats: large 2x2 grid, flat cards ─── */}
        <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3 mb-6">
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              whileTap={{ scale: 0.97 }}
              className="rounded-3xl p-4 flex flex-col justify-between"
              style={{ background: CARD, boxShadow: '0 2px 10px rgba(20,30,45,0.06)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: stat.tintBg, color: stat.tint }}
                >
                  <stat.icon size={18} />
                </div>
                {stat.label === 'Credits' && <BuyCreditsButton currentCredits={credits} compact />}
              </div>
              <div>
                <p className="font-serif text-2xl font-bold" style={{ color: INK }}>
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
                <p className="text-xs font-medium mt-0.5" style={{ color: MUTED }}>{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ─── Quick Actions: modern list-style cards ─── */}
        <motion.div variants={itemVariants} className="mb-6">
          <h2 className="font-serif text-lg font-bold mb-3" style={{ color: INK }}>Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href}>
                <motion.div
                  whileTap={{ scale: 0.96 }}
                  className="rounded-3xl p-4 h-full flex flex-col justify-between"
                  style={{ background: CARD, boxShadow: '0 2px 10px rgba(20,30,45,0.06)' }}
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: action.tintBg, color: action.tint }}
                  >
                    <action.icon size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: INK }}>{action.label}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{action.sub}</p>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* ─── Categories: pill tabs ─── */}
        <motion.div variants={itemVariants} className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {categories.map((category) => {
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all"
                  style={
                    isActive
                      ? { background: ACCENT, color: '#fff' }
                      : { background: CARD, color: MUTED, boxShadow: '0 2px 8px rgba(20,30,45,0.05)' }
                  }
                >
                  <category.icon size={14} />
                  {category.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ─── Featured Events ─── */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-bold" style={{ color: INK }}>Your Events</h2>
            <Link
              href="/client/events"
              className="flex items-center gap-0.5 text-xs font-bold"
              style={{ color: ACCENT }}
            >
              See all <ChevronRight size={13} />
            </Link>
          </div>

          {featuredEvents.length === 0 ? (
            <div className="rounded-3xl p-10 text-center" style={{ background: CARD, boxShadow: '0 2px 10px rgba(20,30,45,0.06)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#E6F0EE' }}>
                <Sparkles className="w-8 h-8" style={{ color: ACCENT }} />
              </div>
              <h3 className="font-serif text-lg font-bold" style={{ color: INK }}>No events yet</h3>
              <p className="text-sm mt-1" style={{ color: MUTED }}>Create your first event to get started.</p>
              <Link
                href={newEventUrl}
                className="inline-flex items-center gap-2 mt-5 px-6 py-3 text-white text-sm font-bold rounded-2xl"
                style={{ background: ACCENT }}
              >
                <Plus size={16} /> Create Event
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {featuredEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="rounded-3xl overflow-hidden"
                  style={{ background: CARD, boxShadow: '0 2px 10px rgba(20,30,45,0.06)' }}
                >
                  <Link href={`/client/events/${event.id}`} className="block">
                    <div className="flex items-stretch">
                      {/* Date block */}
                      <div
                        className="w-20 flex flex-col items-center justify-center text-white flex-shrink-0"
                        style={{ background: event.accentColor }}
                      >
                        <span className="text-[10px] font-bold uppercase opacity-80">{event.weekday}</span>
                        <span className="font-serif text-2xl font-bold leading-none mt-0.5">{event.day}</span>
                        <span className="text-[10px] font-bold uppercase opacity-80 mt-0.5">{event.month}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 p-4 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm truncate" style={{ color: INK }}>{event.name}</h3>
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin size={12} style={{ color: MUTED }} />
                            <span className="text-xs truncate" style={{ color: MUTED }}>{event.venue}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                              style={{ background: '#E6F0EE', color: ACCENT }}
                            >
                              {event.guestCount} guests
                            </span>
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#E7F6EC', color: '#1A7A4A' }}>
                              Active
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center"
                            style={{ background: SURFACE, color: ACCENT }}
                          >
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
      </main>
    </motion.div>
  );
}