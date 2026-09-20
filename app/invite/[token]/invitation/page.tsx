import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getGuestFromToken } from '@/lib/inviteGuest'
import { resolveGuestPageTheme, themeCss, fontImports, GUEST_NAME_SCRIPT_FONT, initialOf } from '@/lib/inviteTheme'
import { getVenueLocation, buildDirectionsUrl, googleMapsEmbedUrl, resolveMapUrl, normalizeMapInput } from '@/lib/maps'
import { fontStack } from '@/lib/fonts'
import { prisma } from '@/lib/prisma'
import RSVPForm from '@/components/RSVPForm'
import WishForm from '@/components/WishForm'
import VenueMap from '@/components/VenueMap'

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

  const venueLocation = await getVenueLocation(theme.mapUrl)
  const venueEmbedUrl = await googleMapsEmbedUrl(theme.mapUrl)
  const venueMapUrl = (await resolveMapUrl(theme.mapUrl)) || normalizeMapInput(theme.mapUrl)

  const wishes = await prisma.guestWish.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const couple =
    event.person1 || event.person2
      ? [event.person1, event.person2].filter(Boolean).join(' na ')
      : null

  const monogram = couple
    ? `${initialOf(event.person1)} & ${initialOf(event.person2)}`
    : event.name.split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join(' & ') || 'J & J'

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
        {/* Bride & groom photo - half-rounded arch frame, animated */}
        {(theme.coupleImage || couple) && (
          <div className="gp-fade-in flex flex-col items-center mb-8">
            <div
              className="gp-couple-arch gp-float-soft relative w-64 h-80 sm:w-72 sm:h-96 overflow-hidden bg-gradient-to-br p-1.5"
              style={{
                borderColor: accentColor,
                background: `linear-gradient(160deg, ${primaryColor}, ${secondaryColor})`,
                boxShadow: `0 20px 44px -14px ${primaryColor}99`,
                borderRadius: '10rem 10rem 1.25rem 1.25rem',
              }}
            >
              <div
                className="relative w-full h-full overflow-hidden"
                style={{ borderRadius: '9.2rem 9.2rem 1rem 1rem' }}
              >
                {theme.coupleImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={theme.coupleImage}
                    alt={couple || 'Bride and groom'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-4xl font-black"
                    style={{ fontFamily: titleFont, color: accentColor }}
                  >
                    {monogram}
                  </div>
                )}
                {/* Inner decorative frame */}
                <div
                  className="pointer-events-none absolute inset-2.5 border"
                  style={{ borderColor: 'rgba(255,255,255,0.6)', borderRadius: '8.1rem 8.1rem 0.75rem 0.75rem' }}
                />
              </div>
            </div>
            {couple && (
              <p
                className="gp-fade-up gp-fade-up-1 mt-5 text-3xl sm:text-4xl font-black text-center break-words"
                style={{ fontFamily: titleFont, color: primaryColor }}
              >
                {couple}
              </p>
            )}
          </div>
        )}

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
        <p className="gp-fade-up gp-fade-up-1 text-center text-[11px] sm:text-xs uppercase tracking-[3px] sm:tracking-[4px] text-gray-400 mb-3">
          {theme.greetingText}
        </p>

        {/* Animated fancy guest name - BIG */}
        <div className="gp-fade-up gp-fade-up-1 text-center mb-10 px-2">
          <p
            className="gp-script gp-shimmer text-5xl sm:text-6xl md:text-7xl leading-snug break-words"
            style={{ fontFamily: `'${GUEST_NAME_SCRIPT_FONT}', cursive`, color: primaryColor }}
          >
            {guestName}
          </p>
        </div>

        {/* Event name + host */}
        <div className="gp-fade-up gp-fade-up-2 text-center mb-10">
          <h3 className="text-lg font-bold uppercase tracking-[3px] text-gray-600 mb-2">{event.name}</h3>
          {event.hostFamily && <p className="text-sm text-gray-500 italic">Hosted by {event.hostFamily}</p>}

          {/* Wedding theme + color dots - shown clearly */}
          {(theme.weddingTheme || theme.themeColors.length > 0) && (
            <div className="gp-fade-scale mt-5 mx-auto max-w-md rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm">
              {theme.weddingTheme && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[3px] text-gray-400 mb-1.5">
                    {theme.themeLabel}
                  </p>
                  <p
                    className="gp-script text-3xl sm:text-4xl tracking-wide break-words"
                    style={{ fontFamily: `'${GUEST_NAME_SCRIPT_FONT}', cursive`, color: primaryColor }}
                  >
                    {theme.weddingTheme}
                  </p>
                </>
              )}
              {theme.themeColors.length > 0 && (
                <>
                  {theme.weddingTheme && <span className="block h-px w-16 mx-auto my-3" style={{ backgroundColor: `${accentColor}66` }} />}
                  <div className="flex items-center justify-center gap-3">
                    {theme.themeColors.map((c, i) => (
                      <span
                        key={i}
                        className="gp-heartbeat w-4 h-4 rounded-full border border-white shadow-md"
                        style={{ backgroundColor: c, boxShadow: `0 4px 12px -4px ${c}`, animationDelay: `${i * 0.25}s` }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Guest's invitation card */}
        {guest.invitationCard && (
          <div className="gp-fade-up gp-fade-up-2 mb-10 flex flex-col items-center">
            <p className="text-[11px] font-semibold uppercase tracking-[2px] text-gray-400 mb-3">
              {theme.invitationCardLabel}
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
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400 m-0 mb-0.5">{theme.dateLabel}</p>
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
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400 m-0 mb-0.5">{theme.timeLabel}</p>
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
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400 m-0 mb-0.5">{theme.venueLabel}</p>
              <p className="text-sm font-semibold text-gray-800 m-0 leading-snug">{event.venue}</p>
              {event.address && <p className="text-xs text-gray-400 m-0 mt-0.5">{event.address}</p>}
            </div>
          </div>
        </div>

        {/* Reception & Contacts */}
        {(theme.contactPerson || theme.contactPersonPhone || theme.masterOfCeremony) && (
          <div className="gp-fade-up gp-fade-up-3 mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="h-px w-16" style={{ backgroundColor: accentColor, opacity: 0.5 }} />
              <span className="text-[11px] font-bold uppercase tracking-[3px] text-gray-500">{theme.receptionLabel}</span>
              <span className="h-px w-16" style={{ backgroundColor: accentColor, opacity: 0.5 }} />
            </div>
            <div className="grid gap-3">
              {(theme.contactPerson || theme.contactPersonPhone) && (
                <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
                  <span className="gp-ornament-sm shrink-0" style={{ borderColor: `${secondaryColor}88`, color: secondaryColor }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h1.5a1 1 0 01.9.55l1.1 2.2a1 1 0 01-.1 1.05l-1.3 1.7a14 14 0 006.5 6.5l1.7-1.3a1 1 0 011.05-.1l2.2 1.1a1 1 0 01.55.9V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400 m-0 mb-0.5">{theme.contactLabel}</p>
                    <p className="text-sm font-semibold text-gray-800 m-0 leading-snug">
                      {theme.contactPerson}
                      {theme.contactPersonPhone && (
                        <>
                          {' · '}
                          <a
                            href={`tel:${theme.contactPersonPhone.replace(/[^+\d]/g, '')}`}
                            className="font-medium text-[#0D4B4B] hover:underline"
                          >
                            {theme.contactPersonPhone}
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
              {theme.masterOfCeremony && (
                <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
                  <span className="gp-ornament-sm shrink-0" style={{ borderColor: `${primaryColor}88`, color: primaryColor }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a3 3 0 00-3 3v1.5M12 2a3 3 0 013 3v1.5M12 5a7 7 0 00-7 7v3a2 2 0 002 2h10a2 2 0 002-2v-3a7 7 0 00-7-7zm-5 12v2a3 3 0 006 0v-2" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400 m-0 mb-0.5">{theme.mocLabel}</p>
                    <p className="text-sm font-semibold text-gray-800 m-0 leading-snug">{theme.masterOfCeremony}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Venue map */}
        {theme.mapUrl && (
          <div className="gp-fade-up gp-fade-up-3 mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="h-px w-16" style={{ backgroundColor: accentColor, opacity: 0.5 }} />
              <span className="text-[11px] font-bold uppercase tracking-[3px] text-gray-500">{theme.mapLabel}</span>
              <span className="h-px w-16" style={{ backgroundColor: accentColor, opacity: 0.5 }} />
            </div>
            {venueEmbedUrl ? (
              <VenueMap
                embedUrl={venueEmbedUrl}
                mapUrl={venueMapUrl}
                lat={venueLocation?.lat}
                lng={venueLocation?.lng}
                label={venueLocation?.label || event.venue || undefined}
                address={event.address || undefined}
                accentColor={accentColor}
                primaryColor={primaryColor}
              />
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 via-gray-50 to-slate-200 px-6 py-8 text-center shadow-sm">
                <svg className="mx-auto h-8 w-8 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: primaryColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <p className="text-sm font-medium text-gray-700 mb-4">{event.venue}</p>
                <a
                  href={venueMapUrl || buildDirectionsUrl([event.venue, event.address].filter(Boolean).join(', '))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Navigate to the venue &#8599;
                </a>
              </div>
            )}
          </div>
        )}

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
            <p className="text-sm text-gray-400">{theme.rsvpHint} &#10084;</p>
          </div>
          <RSVPForm guestId={guest.id} currentStatus={guest.attending} primaryColor={primaryColor} secondaryColor={secondaryColor} />
        </div>

        {/* Wedding Wishes */}
        <div className="gp-fade-up gp-delay-5 mt-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="h-px w-16" style={{ backgroundColor: accentColor, opacity: 0.5 }} />
            <span className="text-[11px] font-bold uppercase tracking-[3px] text-gray-500">{theme.wishesTitle}</span>
            <span className="h-px w-16" style={{ backgroundColor: accentColor, opacity: 0.5 }} />
          </div>
          <p className="text-center text-sm text-gray-400 mb-6">{theme.wishesHint} &#10084;</p>

          <WishForm guestId={guest.id} primaryColor={primaryColor} secondaryColor={secondaryColor} />

          {wishes.length > 0 && (
            <div className="mt-6 space-y-3">
              {wishes.map(wish => (
                <div key={wish.id} className="gp-fade-scale bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-gray-800" style={{ color: primaryColor }}>
                      {wish.guestName}
                    </p>
                    <span className="gp-heartbeat text-xs" style={{ color: primaryColor }}>&#10084;</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed m-0">{wish.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="gp-fade-up gp-delay-5 text-center mt-12">
          <p className="text-[11px] uppercase tracking-[3px] font-semibold mb-2 gp-theme-shimmer" style={{ color: 'transparent' }}>
            &#10053; {theme.footerNote} &#10053;
          </p>
          <p className="text-xs text-gray-400">
            {formatDateShort(event.date)} &middot; {event.venue}
          </p>

          {/* LittleWed footer */}
          <div className="flex flex-col items-center justify-center gap-1.5 mt-4 opacity-60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Little Wed Logo.svg"
              alt="LittleWed"
              className="h-10 w-auto object-contain"
            />
            <span className="text-[9px] uppercase tracking-[3px] text-gray-400 font-semibold">Inviting Made Easy</span>
          </div>

          <Link href={`/invite/${token}`} className="inline-block mt-4 text-[11px] uppercase tracking-[2px] font-semibold text-gray-400 hover:text-gray-600 transition">
            &#11013; Back to the invitation cover
          </Link>
        </div>
      </section>
    </div>
  )
}