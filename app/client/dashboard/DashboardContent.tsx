'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, QrCode, Plus, Coins, Upload, Palette, Send,
  ArrowRight, Settings, BookOpen, MessageSquare, Download, Sparkles,
  Heart, Search, Bell, MapPin, Grid3x3, Eye, CalendarDays, UserCheck,
  CheckCircle, ChevronRight, TrendingUp, Gift, PartyPopper, Camera, Music, Utensils
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import DeleteEventButton from '@/components/DeleteEventButton';
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

// ─── Carousel Component ──────────────────────────────────────────────
const carouselImages = [
  {
    id: 1,
    src: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&h=400&fit=crop',
    title: 'Plan the Perfect Wedding',
    subtitle: 'Manage guest lists, invitations, and check-ins all in one place.',
  },
  {
    id: 2,
    src: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&h=400&fit=crop',
    title: 'Effortless Guest Management',
    subtitle: 'Track RSVPs, send reminders, and check in guests with QR codes.',
  },
  {
    id: 3,
    src: 'https://images.unsplash.com/photo-1532712932145-1d5fbe6cda9b?w=800&h=400&fit=crop',
    title: 'Beautiful Invitation Cards',
    subtitle: 'Design custom cards and send them via WhatsApp or SMS.',
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

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % carouselImages.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 3000);
  };

  const prev = () => {
    setCurrentIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 3000);
  };

  return (
    <div className="relative w-full h-48 md:h-56 rounded-2xl overflow-hidden shadow-md border border-[#E2EAF0]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <Image
            src={carouselImages[currentIndex].src}
            alt={carouselImages[currentIndex].title}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D4F4F]/80 via-[#0D4F4F]/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <h3 className="font-serif text-xl font-bold">{carouselImages[currentIndex].title}</h3>
            <p className="text-sm text-white/80 mt-0.5">{carouselImages[currentIndex].subtitle}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition z-10"
      >
        <ChevronRight size={18} className="rotate-180" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition z-10"
      >
        <ChevronRight size={18} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {carouselImages.map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentIndex ? 'w-7 bg-white' : 'w-1.5 bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
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
    { label: 'Credits', value: credits, icon: Coins, color: '#0D4F4F', bg: '#EAF4F4' },
    { label: 'Total Guests', value: totalGuests, icon: Users, color: '#0D4F4F', bg: '#EAF4F4' },
    { label: 'Checked In', value: checkedIn, icon: UserCheck, color: '#1A7A4A', bg: '#EDFAF4' },
    { label: 'Events', value: events.length, icon: CalendarDays, color: '#C07A20', bg: '#FEF6EC' },
  ];

  const categories = [
    { id: 'all', label: 'All Events', icon: Grid3x3 },
    { id: 'upcoming', label: 'Upcoming', icon: Calendar },
    { id: 'live', label: 'Live', icon: Eye },
    { id: 'completed', label: 'Completed', icon: CheckCircle },
  ];

  const quickActions = [
    { label: 'New Event', icon: Plus, href: newEventUrl, color: '#0D4F4F' },
    { label: 'Import Guests', icon: Upload, href: '/client/guests/import/select-event', color: '#1A7A4A' },
    { label: 'Design Card', icon: Palette, href: '/client/invitations/design/select-event', color: '#C07A20' },
    { label: 'Send Invites', icon: Send, href: '/client/invitations/send/select-event', color: '#0D4F4F' },
    { label: 'Backup Guests', icon: Download, href: '/client/guests/backup', color: '#6B3FA0' },
  ];

  const featuredEvents = events.slice(0, 3).map((event, index) => {
    const d = new Date(event.date);
    const colors = ['#0D4F4F', '#1A7A4A', '#C07A20'];
    return {
      ...event,
      accentColor: colors[index % colors.length],
      day: d.getDate(),
      month: d.toLocaleString('default', { month: 'short' }),
      guestCount: event._count.guests,
    };
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, damping: 22, stiffness: 100 },
    },
  };

  const statVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: 'spring' as const, damping: 20, stiffness: 80 },
    },
  };

  return (
    <motion.div
      className="min-h-screen bg-[#F0F4F8] pb-8 font-sans"
      initial="hidden"
      animate={isLoaded ? 'visible' : 'hidden'}
      variants={containerVariants}
    >
      {/* ─── Main Content ─── */}
      <main className="max-w-lg mx-auto px-4 pt-4 pb-8">
        {/* ─── Welcome Section ─── */}
        <motion.div variants={itemVariants} className="mb-5">
          <h1 className="font-serif text-2xl font-bold text-[#0D1B1B]">
            Hello, <span className="text-[#0D4F4F]">{firstName}</span> 👋
          </h1>
          <p className="text-sm text-[#7A8FA6]">Your wedding planning dashboard</p>
        </motion.div>

        {/* ─── Carousel ─── */}
        <motion.div variants={itemVariants} className="mb-5">
          <EventCarousel />
        </motion.div>

        {/* ─── Stats Grid ─── */}
        <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3 mb-5">
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={statVariants}
              whileHover={{ y: -2 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2EAF0]"
            >
              <div className="flex items-center justify-between">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: stat.bg, color: stat.color }}
                >
                  <stat.icon size={17} />
                </div>
                <span className="font-serif text-xl font-bold text-[#0D1B1B]">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-[#7A8FA6] font-medium">{stat.label}</p>
                {stat.label === 'Credits' && (
                  <BuyCreditsButton currentCredits={credits} compact />
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ─── Quick Actions ─── */}
        <motion.div variants={itemVariants} className="mb-5">
          <h2 className="font-serif text-base font-bold text-[#0D1B1B] mb-3">Quick Actions</h2>
          <div className="grid grid-cols-5 gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center gap-1.5 p-2.5 bg-white rounded-xl shadow-sm border border-[#E2EAF0] hover:shadow-md transition-all active:scale-95"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${action.color}10`, color: action.color }}>
                  <action.icon size={16} />
                </div>
                <span className="text-[9px] font-medium text-[#4A6072] text-center leading-tight">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* ─── Categories ─── */}
        <motion.div variants={itemVariants} className="mb-5">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((category) => {
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#0D4F4F] text-white shadow-sm'
                      : 'bg-white text-[#4A6072] border border-[#E2EAF0] hover:bg-[#F0F4F8]'
                  }`}
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
            <h2 className="font-serif text-base font-bold text-[#0D1B1B]">Featured Events</h2>
            <Link href="/client/events" className="text-xs font-medium text-[#0D4F4F] hover:underline">
              See All →
            </Link>
          </div>

          {featuredEvents.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-[#E2EAF0]">
              <div className="w-16 h-16 rounded-2xl bg-[#F0F4F8] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-8 h-8 text-[#7A8FA6]" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#0D1B1B]">No events yet</h3>
              <p className="text-sm text-[#7A8FA6] mt-1">Create your first event to get started.</p>
              <Link
                href={newEventUrl}
                className="inline-flex items-center gap-2 mt-4 px-6 py-2.5 bg-[#0D4F4F] text-white text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                <Plus size={16} /> Create Event
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {featuredEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  whileHover={{ y: -2 }}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2EAF0]"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0 shadow-sm"
                      style={{ background: event.accentColor }}
                    >
                      <span className="font-serif text-lg font-bold leading-none">{event.day}</span>
                      <span className="text-[8px] font-bold uppercase opacity-85">{event.month}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link href={`/client/events/${event.id}`}>
                            <h3 className="font-semibold text-sm text-[#0D1B1B] truncate">{event.name}</h3>
                          </Link>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-[#7A8FA6] flex items-center gap-1">
                              <MapPin size={11} />
                              {event.venue}
                            </span>
                            <span className="text-xs text-[#7A8FA6] flex items-center gap-1">
                              <Users size={11} />
                              {event.guestCount}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <DeleteEventButton eventId={event.id} />
                          <Link
                            href={`/client/events/${event.id}`}
                            className="w-7 h-7 rounded-lg bg-[#F0F4F8] hover:bg-[#E2EAF0] flex items-center justify-center text-[#7A8FA6] hover:text-[#0D4F4F] transition-colors"
                          >
                            <ChevronRight size={14} />
                          </Link>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-medium text-[#7A8FA6] bg-[#F0F4F8] px-2 py-0.5 rounded-full">
                          {event._count.guests} guests
                        </span>
                        <span className="text-[10px] font-medium text-[#1A7A4A] bg-[#EDFAF4] px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </motion.div>
  );
}