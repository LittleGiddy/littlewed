'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Sparkles, Calendar, Users, QrCode } from 'lucide-react';

const slides = [
  {
    id: 1,
    title: 'Plan the Perfect Wedding',
    description: 'Manage guest lists, invitations, and check-ins all in one place.',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&h=500&fit=crop',
    cta: 'Get Started',
  },
  {
    id: 2,
    title: 'Effortless Guest Management',
    description: 'Track RSVPs, send reminders, and check in guests with QR codes.',
    image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1200&h=500&fit=crop',
    cta: 'Explore',
  },
  {
    id: 3,
    title: 'Beautiful Invitation Cards',
    description: 'Design custom invitation cards and send them via WhatsApp or SMS.',
    image: 'https://images.unsplash.com/photo-1532712932145-1d5fbe6cda9b?w=1200&h=500&fit=crop',
    cta: 'Design Now',
  },
];

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goTo = (index: number) => {
    setCurrent(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 5000);
  };

  const prev = () => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 5000);
  };

  const next = () => {
    setCurrent((prev) => (prev + 1) % slides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 5000);
  };

  return (
    <div className="relative w-full h-[280px] md:h-[340px] overflow-hidden bg-[#0D2E2E]">
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            index === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={slide.image}
            alt={slide.title}
            fill
            className="object-cover"
            priority={index === 0}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D2E2E]/80 via-[#0D2E2E]/40 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-2xl px-6 md:px-12">
              <h2 className="font-serif text-2xl md:text-4xl font-black text-white leading-tight">
                {slide.title}
              </h2>
              <p className="mt-2 text-white/80 text-sm md:text-base max-w-md">
                {slide.description}
              </p>
              <button className="mt-4 px-6 py-2.5 bg-white text-[#0D4F4F] font-bold rounded-xl text-sm hover:bg-gray-100 transition shadow-lg">
                {slide.cta} →
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Navigation Arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition z-10"
        aria-label="Previous slide"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition z-10"
        aria-label="Next slide"
      >
        <ChevronRight size={18} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === current ? 'w-6 bg-white' : 'bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Feature badges on carousel */}
      <div className="absolute bottom-12 right-6 hidden md:flex gap-2 z-10">
        <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-white/80 text-xs font-medium px-3 py-1.5 rounded-full border border-white/10">
          <Sparkles size={12} /> Smart Planning
        </div>
        <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-white/80 text-xs font-medium px-3 py-1.5 rounded-full border border-white/10">
          <QrCode size={12} /> QR Check-in
        </div>
        <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-white/80 text-xs font-medium px-3 py-1.5 rounded-full border border-white/10">
          <Users size={12} /> Guest Management
        </div>
      </div>
    </div>
  );
}