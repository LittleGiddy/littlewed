import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getGuestFromToken } from '@/lib/inviteGuest'
import { resolveGuestPageTheme, themeCss, fontImports } from '@/lib/inviteTheme'
import { fontStack } from '@/lib/fonts'
import RSVPForm from '@/components/RSVPForm'

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

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const guest = await getGuestFromToken(token)
  if (!guest) notFound()

  const event = guest.event
  const theme = resolveGuestPageTheme(event, event.tenant)
  const { primaryColor, secondaryColor, accentColor } = theme

  const couple =
    event.person1 || event.person2
      ? [event.person1, event.person2].filter(Boolean).join(' na ')
      : null

  const titleFont = fontStack(theme.fontFamily)
  const guestName = [guest.title, guest.name].filter(Boolean).join(' ')

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFDF8' }}>
      <style>{fontImports(theme)}</style>
      <style>{themeCss(theme)}</style>
      <style>{`
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
        .gp-card-image {
          filter: drop-shadow(0 18px 34px rgba(0,0,0,0.18));
          animation: gpFloatSoft 6s ease-in-out infinite;
        }
      `}</style>

      {/* ═══════════════ HEADER STRIP ═══════════════ */}
      <header
        className="py-5 px-4 text-center"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
      >
        <Link href={`/invite/${token}`} className="inline-flex flex-col items-center gap-1 text-white/95 hover:text-white transition">
          <span className="text-[10px] uppercase tracking-[3px] font-semibold opacity-80">Back to the invitation</span>
          <span className="font-black text-lg" style={{ fontFamily: titleFont }}>
            {couple || event.name}
          </span>
        </Link>
      </header>

      {/* ═══════════════ DETAILS ═══════════════ */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-20 max-w-2xl mx-auto">
        {/* Top ornament */}
        <div className="gp-fade-in flex justify-center mb-5">
          <span className="gp-ornament text-lg">&#10053;</span>
        </div>

        {/* Soft accent underline */}
        <div className="gp-fade-up gp-fade-up-1 flex items-center justify-center gap-2 mb-4">
          <span className="h-px w-16 sm:w-24 gp-line-glow" style={{ backgroundColor: accentColor, opacity: 0.5 }} />
          <span className="w-1.5 h-1.5 rotate-45" style={{ backgroundColor: accentColor }} />
          <span className="h-px w-16 sm:w-24 gp-line-glow" style={{ backgroundColor: accentColor, opacity: 0.5 }} />
        </div>

        <h2
          className="gp-fade-up gp-fade-up-1 text-center text-3xl sm:text-4xl font-black mb-2 break-words"
          style={{ fontFamily: titleFont, color: primaryColor }}
        >
          {theme.detailsTitle}
        </h2>
        <p className="gp-fade-up gp-fade-up-1 text-center text-sm text-gray-400 mb-10">
          {guestName}, we would be honored to have you join us
        </p>

        {/* Event name + host */}
        <div className="gp-fade-up gp-fade-up-2 text-center mb-10">
          <h3 className="text-lg font-bold uppercase tracking-[3px] text-gray-600 mb-2">{event.name}</h3>
          {event.hostFamily && <p className="text-sm text-gray-500 italic">Hosted by {event.hostFamily}</p>}
          {couple && (
            <p className="mt-2 text-2xl font-bold text-gray-800" style={{ fontFamily: titleFont }}>
              {couple}
            </p>
          )}
        </div>

        {/* Guest's invitation card */}
        {guest.invitationCard && (
          <div className="gp-fade-up gp-fade-up-2 mb-10 flex flex-col items-center">
            <p className="text-[11px] font-semibold uppercase tracking-[2px] text-gray-400 mb-3">
              Your invitation card
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={guest.invitationCard}
              alt={`Invitation card for ${guestName}`}
              className="gp-card-image rounded-2xl max-w-full mx-auto max-h-[420px] sm:max-h-[560px] h-auto"
              style={{ width: 'auto' }}
            />
          </div>
        )}

        {/* Card number */}
        {guest.cardNumber && (
          <div className="gp-fade-up gp-fade-up-2 flex justify-center mb-10">
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide"
              style={{ backgroundColor: `${accentColor}22`, color: '#7A5B00', border: `1px solid ${accentColor}66` }}
            >
              &#9830; Card No: {guest.cardNumber}
            </span>
          </div>
        )}

        {/* Event info cards */}
        <div className="gp-fade-up gp-fade-up-3 grid gap-3 mb-12">
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
            <span className="gp-ornament-sm shrink-0" style={{ borderColor: `${primaryColor}88`, color: primaryColor }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400 m-0 mb-0.5">Date</p>
              <p className="text-sm font-semibold text-gray-800 m-0 leading-snug">{formatDate(event.date)}</p>
            </div>
          </div>

          {event.time && (
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
              <span className="gp-ornament-sm shrink-0" style={{ borderColor: `${secondaryColor}88`, color: secondaryColor }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400 m-0 mb-0.5">Time</p>
                <p className="text-sm font-semibold text-gray-800 m-0 leading-snug">{event.time}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
            <span className="gp-ornament-sm shrink-0" style={{ borderColor: `${primaryColor}88`, color: primaryColor }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400 m-0 mb-0.5">Venue</p>
              <p className="text-sm font-semibold text-gray-800 m-0 leading-snug">{event.venue}</p>
              {event.address && <p className="text-xs text-gray-400 m-0 mt-0.5">{event.address}</p>}
            </div>
          </div>
        </div>

        {/* RSVP */}
        <div
          className="gp-fade-up gp-delay-4 bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-lg"
          style={{ boxShadow: `0 12px 40px -18px ${primaryColor}88` }}
        >
          <div className="text-center mb-6">
            <div className="gp-ornament-sm text-xs mb-4" style={{ display: 'inline-flex', marginBottom: '0.75rem', borderColor: `${accentColor}88`, color: '#7A5B00' }}>&#10053;</div>
            <h3 className="text-2xl font-black text-gray-800 mb-1 break-words" style={{ fontFamily: titleFont, color: primaryColor }}>
              {theme.rsvpTitle}
            </h3>
            <p className="text-sm text-gray-400">Kindly RSVP so we can plan for you &#10084;</p>
          </div>
          <RSVPForm guestId={guest.id} currentStatus={guest.attending} primaryColor={primaryColor} secondaryColor={secondaryColor} />
        </div>

        {/* Footer */}
        <div className="gp-fade-up gp-delay-5 text-center mt-12">
          <p className="text-[11px] uppercase tracking-[3px] font-semibold mb-2 gp-theme-shimmer" style={{ color: 'transparent' }}>
            &#10053; {theme.footerNote} &#10053;
          </p>
          <p className="text-xs text-gray-400">
            {formatDateShort(event.date)} &middot; {event.venue}
          </p>
          <Link href={`/invite/${token}`} className="inline-block mt-4 text-[11px] uppercase tracking-[2px] font-semibold text-gray-400 hover:text-gray-600 transition">
            &#11013; Back to the invitation cover
          </Link>
        </div>
      </section>
    </div>
  )
}