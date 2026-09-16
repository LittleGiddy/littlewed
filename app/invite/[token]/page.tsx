import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import RSVPForm from '@/components/RSVPForm'
import { notFound } from 'next/navigation'
import { fontStack, googleFontsImport } from '@/lib/fonts'

async function getGuestFromToken(token: string) {
  // Order: try passCode first (matches the /invite/<passCode> links used in
  // invitations), then fall back to the legacy signed-JWT token.
  const byPassCode = await prisma.guest.findUnique({
    where: { passCode: token },
    include: { event: { include: { tenant: true } } },
  });
  if (byPassCode) return byPassCode;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    )
    const guestId = payload.guestId as string
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      include: { event: { include: { tenant: true } } },
    })
    return guest
  } catch {
    return null
  }
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateShort(date: Date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function initialOf(name?: string | null): string {
  if (!name) return '?'
  const first = name.trim().split(/\s+/)[0] || ''
  return (first[0] || '?').toUpperCase()
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guest = await getGuestFromToken(token)

  if (!guest) {
    notFound()
  }

  const event = guest.event
  const tenant = event.tenant

  const couple =
    event.person1 || event.person2
      ? [event.person1, event.person2].filter(Boolean).join(' na ')
      : null

  const primaryColor = tenant?.guestPagePrimaryColor ?? '#BE185D'
  const secondaryColor = tenant?.guestPageSecondaryColor ?? '#6D28D9'
  const accentColor = tenant?.guestPageAccentColor ?? '#F6C445'
  const titleFont = fontStack(tenant?.guestPageFontFamily)
  const headerImage = tenant?.guestPageHeaderImage || event.imageUrl

  const autoTitle =
    event.person1 || event.person2
      ? `${initialOf(event.person1)} & ${initialOf(event.person2)} Night`
      : null

  const heroTitle = tenant?.guestPageTitle || autoTitle || (couple ? couple + ' Night' : event.name)
  const heroSubtitle = tenant?.guestPageSubtitle || 'You are cordially invited'

  const heroBackground = headerImage
    ? `linear-gradient(160deg, ${primaryColor}E6, ${secondaryColor}E6), url('${headerImage}') center/cover`
    : `linear-gradient(160deg, ${primaryColor}, ${secondaryColor})`

  const guestName = [guest.title, guest.name].filter(Boolean).join(' ')

  return (
    <div
      className="min-h-screen scroll-smooth"
      style={{ backgroundColor: '#FFFDF8' }}
    >
      {/* Load the tenant-selected title font */}
      <style>{googleFontsImport(tenant?.guestPageFontFamily)}</style>
      <style>{`
        .gp-fade-in { animation: gpFadeIn 1s ease-out both; }
        .gp-fade-up { animation: gpFadeUp 0.9s ease-out both; }
        .gp-fade-up-1 { animation-delay: 0.15s; }
        .gp-fade-up-2 { animation-delay: 0.3s; }
        .gp-fade-up-3 { animation-delay: 0.45s; }
        .gp-delay-4 { animation-delay: 0.6s; }
        .gp-delay-5 { animation-delay: 0.75s; }
        @keyframes gpFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gpFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .gp-bounce-arrow { animation: gpBounce 2s ease-in-out infinite; }
        @keyframes gpBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(10px); }
        }
        .gp-ornament {
          display: inline-flex; align-items: center; justify-content: center;
          width: 2.5rem; height: 2.5rem; border-radius: 9999px;
          border: 1.5px dashed ${accentColor};
          color: ${accentColor};
        }
        .gp-ornament-sm {
          display: inline-flex; align-items: center; justify-content: center;
          width: 2rem; height: 2rem; border-radius: 9999px;
          border: 1.5px dashed ${accentColor};
          color: ${accentColor}; font-size: 0.8rem;
        }
      `}</style>

      {/* ═══════════════ HERO ═══════════════ */}
      <section
        id="top"
        className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-6 pb-16 pt-24 text-white overflow-hidden"
        style={{ background: heroBackground }}
      >
        {/* Soft radial glow */}
        <div
          className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-25 blur-3xl"
          style={{ backgroundColor: accentColor }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: '#ffffff' }}
        />

        {/* Decorative frame corners */}
        <span className="absolute top-6 left-6 w-10 h-10 border-t-2 border-l-2 rounded-tl-2xl opacity-60" style={{ borderColor: accentColor }} />
        <span className="absolute top-6 right-6 w-10 h-10 border-t-2 border-r-2 rounded-tr-2xl opacity-60" style={{ borderColor: accentColor }} />
        <span className="absolute bottom-6 left-6 w-10 h-10 border-b-2 border-l-2 rounded-bl-2xl opacity-60" style={{ borderColor: accentColor }} />
        <span className="absolute bottom-6 right-6 w-10 h-10 border-b-2 border-r-2 rounded-br-2xl opacity-60" style={{ borderColor: accentColor }} />

        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
          {/* Flourish */}
          <div className="gp-fade-in text-3xl mb-4" style={{ color: accentColor }}>&#10053;</div>

          <p
            className="gp-fade-up gp-fade-up-1 text-[12px] uppercase font-semibold tracking-[4px] mb-5"
            style={{ color: accentColor }}
          >
            {heroSubtitle}
          </p>

          <h1
            className="gp-fade-up gp-fade-up-2 text-6xl sm:text-7xl font-black leading-[1.05] drop-shadow-lg mb-6"
            style={{ fontFamily: titleFont, textShadow: '0 4px 30px rgba(0,0,0,0.25)' }}
          >
            {heroTitle}
          </h1>

          {/* Gold divider */}
          <div className="gp-fade-up gp-fade-up-3 flex items-center gap-3 mb-7">
            <span className="w-12 h-px" style={{ backgroundColor: accentColor, opacity: 0.7 }} />
            <span className="text-base" style={{ color: accentColor }}>&#9830;</span>
            <span className="w-12 h-px" style={{ backgroundColor: accentColor, opacity: 0.7 }} />
          </div>

          {couple && (
            <p className="gp-fade-up gp-delay-4 text-xl sm:text-2xl font-medium mb-2" style={{ fontFamily: titleFont, color: '#fff' }}>
              {couple}
            </p>
          )}

          {event.hostFamily && (
            <p className="gp-fade-up gp-delay-4 text-sm text-white/85 mb-1">
              Together with their families
            </p>
          )}

          <p className="gp-fade-up gp-delay-5 text-sm text-white/75 mb-10">
            {guestName}, you are invited
          </p>

          {/* Scroll-down button */}
          <a
            href="#details"
            className="gp-fade-up gp-delay-5 group inline-flex flex-col items-center gap-2 text-white/90 hover:text-white transition"
          >
            <span className="text-[11px] uppercase tracking-[3px] font-semibold">View Invitation</span>
            <span className="gp-bounce-arrow w-11 h-11 rounded-full border border-white/60 flex items-center justify-center group-hover:bg-white/20 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </span>
          </a>
        </div>
      </section>

      {/* ═══════════════ DETAILS ═══════════════ */}
      <section id="details" className="relative px-4 sm:px-6 py-16 max-w-2xl mx-auto">
        {/* Top ornament */}
        <div className="flex justify-center mb-6">
          <span className="gp-ornament text-lg">&#10053;</span>
        </div>

        <h2
          className="text-center text-3xl sm:text-4xl font-black text-gray-800 mb-2"
          style={{ fontFamily: titleFont }}
        >
          The Invitation
        </h2>
        <p className="text-center text-sm text-gray-400 mb-10">
          We would be honored to have you join us
        </p>

        {/* Event name + host */}
        <div className="text-center mb-10">
          <h3 className="text-lg font-bold uppercase tracking-[3px] text-gray-600 mb-2">{event.name}</h3>
          {event.hostFamily && (
            <p className="text-sm text-gray-500 italic">Hosted by {event.hostFamily}</p>
          )}
          {couple && (
            <p className="mt-2 text-2xl font-bold text-gray-800" style={{ fontFamily: titleFont }}>
              {couple}
            </p>
          )}
        </div>

        {/* Guest's invitation card */}
        {guest.invitationCard && (
          <div className="mb-10 flex flex-col items-center">
            <p className="text-[11px] font-semibold uppercase tracking-[2px] text-gray-400 mb-3">
              Your invitation card
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={guest.invitationCard}
              alt={`Invitation card for ${guestName}`}
              className="rounded-2xl shadow-2xl max-w-full mx-auto"
              style={{ maxHeight: 560, width: 'auto' }}
            />
          </div>
        )}

        {/* Card number */}
        {guest.cardNumber && (
          <div className="flex justify-center mb-10">
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide"
              style={{ backgroundColor: `${accentColor}22`, color: '#7A5B00', border: `1px solid ${accentColor}66` }}
            >
              &#9830; Card No: {guest.cardNumber}
            </span>
          </div>
        )}

        {/* Event info cards */}
        <div className="grid gap-3 mb-12">
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm">
            <span className="gp-ornament-sm shrink-0" style={{ borderColor: `${primaryColor}88`, color: primaryColor }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400 m-0 mb-0.5">Date</p>
              <p className="text-sm font-semibold text-gray-800 m-0">{formatDate(event.date)}</p>
            </div>
          </div>

          {event.time && (
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm">
              <span className="gp-ornament-sm shrink-0" style={{ borderColor: `${secondaryColor}88`, color: secondaryColor }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400 m-0 mb-0.5">Time</p>
                <p className="text-sm font-semibold text-gray-800 m-0">{event.time}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm">
            <span className="gp-ornament-sm shrink-0" style={{ borderColor: `${primaryColor}88`, color: primaryColor }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400 m-0 mb-0.5">Venue</p>
              <p className="text-sm font-semibold text-gray-800 m-0">{event.venue}</p>
              {event.address && <p className="text-xs text-gray-400 m-0 mt-0.5">{event.address}</p>}
            </div>
          </div>
        </div>

        {/* RSVP */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-6 sm:p-8">
          <div className="text-center mb-6">
            <span className="gp-ornament-sm text-xs mb-4" style={{ display: 'inline-flex', marginBottom: '0.75rem', borderColor: `${accentColor}88`, color: '#7A5B00' }}>
              &#10053;
            </span>
            <h3 className="text-2xl font-black text-gray-800 mb-1" style={{ fontFamily: titleFont }}>
              Will You Attend?
            </h3>
            <p className="text-sm text-gray-400">Kindly RSVP so we can plan for you &#10084;</p>
          </div>
          <RSVPForm guestId={guest.id} currentStatus={guest.attending} />
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-[11px] uppercase tracking-[3px] text-gray-300 font-semibold mb-2">
            &#10053; With love &#10053;
          </p>
          <p className="text-xs text-gray-400">
            {formatDateShort(event.date)} &middot; {event.venue}
          </p>
        </div>
      </section>
    </div>
  )
}