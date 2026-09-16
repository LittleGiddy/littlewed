import { notFound } from 'next/navigation'
import { getGuestFromToken } from '@/lib/inviteGuest'
import { resolveGuestPageTheme, themeCss, fontImports, initialOf, GUEST_NAME_SCRIPT_FONT } from '@/lib/inviteTheme'
import { fontStack } from '@/lib/fonts'

function formatDateShort(date: Date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Deterministic floating petals so SSR render is stable
const PETALS = Array.from({ length: 8 }, (_, i) => ({
  left: (i * 13 + 5) % 96,
  delay: (i * 1.7) % 8,
  duration: 9 + (i % 5) * 1.6,
  size: 12 + (i % 3) * 6,
  glyph: ['&#10052;', '&#10048;', '&#10052;', '&#10047;'][i % 4],
}))

export default async function InviteLanding({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const guest = await getGuestFromToken(token)
  if (!guest) notFound()

  const event = guest.event
  const theme = resolveGuestPageTheme(event, event.tenant)

  const couple =
    event.person1 || event.person2
      ? [event.person1, event.person2].filter(Boolean).join(' & ')
      : null

  const titleFont = fontStack(theme.fontFamily)
  const heroTitle = theme.title || (couple ? `${initialOf(event.person1)} & ${initialOf(event.person2)} Night` : event.name)
  const monogram = couple
    ? `${initialOf(event.person1)} & ${initialOf(event.person2)}`
    : event.name.split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join(' & ') || 'J & J'

  const heroBackground = theme.headerImage
    ? `linear-gradient(160deg, ${theme.primaryColor}E6, ${theme.secondaryColor}E6), url('${theme.headerImage}') center/cover`
    : `linear-gradient(160deg, ${theme.primaryColor}, ${theme.secondaryColor})`

  const guestName = [guest.title, guest.name].filter(Boolean).join(' ')

  return (
    <div className="min-h-screen">
      <style>{fontImports(theme)}</style>
      <style>{themeCss(theme)}</style>

      {/* ═══════════════════ HERO / LANDING ═══════════════════ */}
      <section
        className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-5 py-20 overflow-hidden"
        style={{ background: heroBackground, color: '#fff' }}
      >
        {/* Slow zoom background photo */}
        {theme.headerImage && (
          <>
            <div
              className="gp-slow-zoom absolute inset-0"
              style={{ backgroundImage: `url('${theme.headerImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
            <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${theme.primaryColor}D9, ${theme.secondaryColor}D9)` }} />
          </>
        )}

        {/* Glow blobs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-25 blur-3xl" style={{ backgroundColor: theme.accentColor }} />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: '#ffffff' }} />

        {/* Floating petals */}
        {PETALS.map((p, i) => (
          <span
            key={i}
            className="gp-petal"
            style={{
              left: `${p.left}%`,
              fontSize: p.size,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              color: theme.accentColor,
            }}
            dangerouslySetInnerHTML={{ __html: p.glyph }}
          />
        ))}

        {/* Decorative frame corners */}
        <span className="absolute top-4 left-4 w-10 h-10 border-t-2 border-l-2 rounded-tl-2xl opacity-60" style={{ borderColor: theme.accentColor }} />
        <span className="absolute top-4 right-4 w-10 h-10 border-t-2 border-r-2 rounded-tr-2xl opacity-60" style={{ borderColor: theme.accentColor }} />
        <span className="absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 rounded-bl-2xl opacity-60" style={{ borderColor: theme.accentColor }} />
        <span className="absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 rounded-br-2xl opacity-60" style={{ borderColor: theme.accentColor }} />

        <div className="relative z-10 flex flex-col items-center gap-5 max-w-2xl mx-auto">
          {/* Couple photo or monogram */}
          {theme.coupleImage ? (
            <div
              className="gp-fade-in gp-ring-pulse w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 bg-white/10"
              style={{ borderColor: theme.accentColor }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={theme.coupleImage} alt={heroTitle} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="gp-fade-in gp-ring-pulse w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center text-3xl sm:text-4xl font-black border-2 backdrop-blur-sm"
              style={{
                borderColor: `${theme.accentColor}aa`,
                background: 'rgba(255,255,255,0.12)',
                color: theme.accentColor,
                fontFamily: titleFont,
              }}
            >
              {monogram}
            </div>
          )}

          {/* Kicker */}
          <p className="gp-fade-up gp-fade-up-1 text-[10px] sm:text-xs uppercase font-semibold tracking-[3px] sm:tracking-[4px] text-white/85">
            {event.hostFamily ? 'Together with their families' : 'With joy and happy hearts'}
          </p>

          {/* Ornament */}
          <div className="gp-fade-up gp-fade-up-1 text-2xl leading-none" style={{ color: theme.accentColor }}>
            &#10053;
          </div>

          {/* Animated fancy guest name */}
          <div className="gp-fade-up gp-fade-up-2 w-full px-2">
            <p className="text-[11px] sm:text-sm uppercase tracking-[4px] text-white/90 font-medium mb-1">
              Dear {guestName},
            </p>
            <p
              className="gp-script gp-shimmer text-5xl sm:text-6xl md:text-7xl leading-tight break-words"
              style={{ fontFamily: `'${GUEST_NAME_SCRIPT_FONT}', cursive` }}
            >
              You are cordially invited
            </p>
          </div>

          {/* Couple + event name */}
          <div className="gp-fade-up gp-fade-up-3 flex flex-col items-center gap-1">
            {couple && (
              <p className="text-2xl sm:text-3xl font-black text-white drop-shadow-lg" style={{ fontFamily: titleFont }}>
                {couple}
              </p>
            )}
            <p className="text-sm sm:text-base text-white/90 lowercase tracking-[1px] first-letter:uppercase">
              to the celebration of {event.name}
            </p>
          </div>

          {/* Date line */}
          <div className="gp-fade-up gp-fade-up-3 flex items-center gap-3">
            <span className="h-px w-10" style={{ backgroundColor: theme.accentColor, opacity: 0.7 }} />
            <span className="text-sm sm:text-base text-white/95 font-medium whitespace-nowrap">
              {formatDateShort(event.date)} {event.time ? `&middot; ${event.time}` : ''}
            </span>
            <span className="h-px w-10" style={{ backgroundColor: theme.accentColor, opacity: 0.7 }} />
          </div>

          {/* Wedding theme + color dots */}
          {(theme.weddingTheme || theme.themeColors.length > 0) && (
            <div className="gp-fade-up gp-fade-up-3 gp-fade-scale flex flex-col items-center gap-2 px-4">
              {theme.weddingTheme && (
                <p
                  className="gp-script text-xl sm:text-2xl tracking-wide"
                  style={{ fontFamily: `'${GUEST_NAME_SCRIPT_FONT}', cursive`, color: theme.accentColor }}
                >
                  {theme.weddingTheme}
                </p>
              )}
              {theme.themeColors.length > 0 && (
                <div className="flex items-center gap-2.5">
                  {theme.themeColors.map((c, i) => (
                    <span
                      key={i}
                      className="gp-sway gp-color-dot-glow w-3.5 h-3.5 rounded-full border border-white/60"
                      style={{ backgroundColor: c, animationDelay: `${i * 0.3}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <a
            href={`/invite/${token}/invitation`}
            className="gp-fade-up gp-fade-up-3 gp-btn-glow mt-3 inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-bold text-sm sm:text-base text-white transition transform hover:-translate-y-0.5"
            style={{
              fontFamily: titleFont,
              background: `linear-gradient(135deg, ${theme.themeColor}, ${theme.primaryColor})`,
            }}
          >
            Open Your Invitation
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>

        {/* Footer: logo + tagline + mini note */}
        <div className="absolute bottom-3 inset-x-0 z-10 flex flex-col items-center gap-1.5 px-4 text-center">
          <p className="text-[10px] uppercase tracking-[3px] text-white/50 leading-relaxed">
            {formatDateShort(event.date)} &middot; {event.venue}
          </p>
          <div className="flex items-center justify-center gap-2 opacity-75">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/White Little Wed Logo.svg"
              alt="LittleWed"
              className="h-7 w-auto object-contain drop-shadow"
            />
            <span className="text-[10px] uppercase tracking-[3px] text-white/60">Inviting Made Easy</span>
          </div>
        </div>
      </section>
    </div>
  )
}