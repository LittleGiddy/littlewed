'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Mail } from 'lucide-react'
import { GUEST_NAME_SCRIPT_FONT } from '@/lib/inviteTheme'
import type { GuestPageTheme } from '@/lib/inviteTheme'
import { fontStack } from '@/lib/fonts'

interface InvitationCoverProps {
  token: string
  theme: GuestPageTheme
  coupleName: string | null
  eventName: string
  eventDate: string
  guestName: string
}

/**
 * Polished landing cover: an envelope keeps its wax seal and folds, while the
 * couple's names live in a clear text block *below* the envelope — so nothing
 * is ever blocked. Tapping anywhere opens the invitation.
 */
export default function InvitationCover({
  token,
  theme,
  coupleName,
  eventName,
  eventDate,
  guestName,
}: InvitationCoverProps) {
  const router = useRouter()
  const [opened, setOpened] = useState(false)
  const [gone, setGone] = useState(false)

  const { primaryColor, secondaryColor, accentColor, headerImage } = theme
  const titleFont = fontStack(theme.fontFamily)
  const scriptFont = `'${GUEST_NAME_SCRIPT_FONT}', cursive`
  const display = coupleName || eventName

  useEffect(() => {
    if (gone) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [gone])

  const handleOpen = () => {
    if (opened) return
    setOpened(true)
    window.setTimeout(() => {
      setGone(true)
      router.push(`/invite/${token}/invitation`)
    }, 950)
  }

  const sealDiameter = '3.25rem'

  return (
    <>
      <style>{`
        @keyframes lwCoverCard {
          0% { transform: scale(1) translateY(0); opacity: 1; }
          35% { transform: scale(1.04) translateY(-8px); opacity: 1; }
          55% { transform: scale(1.02) translateY(-4px); opacity: 1; }
          100% { transform: scale(2.6) translateY(-4vh); opacity: 0; }
        }
        @keyframes lwCoverBackdrop {
          to { opacity: 0; }
        }
        @keyframes lwCoverIn {
          from { opacity: 0; transform: translateY(26px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lwSealPulse {
          0%, 100% { box-shadow: 0 8px 18px -6px rgba(0,0,0,0.45), 0 0 0 0 rgba(255,255,255,0.35); }
          50% { box-shadow: 0 8px 18px -6px rgba(0,0,0,0.45), 0 0 0 12px rgba(255,255,255,0); }
        }
        @keyframes lwFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lw-float-in, .lw-seal, .lw-float-env { animation: none !important; }
        }
      `}</style>

      {!gone && (
        <button
          type="button"
          onClick={handleOpen}
          aria-label={theme.coverHint}
          className="fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center overflow-hidden border-0 p-4"
          style={{
            backgroundImage: headerImage
              ? `linear-gradient(160deg, ${primaryColor}EE, ${secondaryColor}EE), url('${headerImage}')`
              : `linear-gradient(160deg, ${primaryColor}EE, ${secondaryColor}EE)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: '#fff',
            pointerEvents: opened ? 'none' : 'auto',
            animation: opened ? 'lwCoverBackdrop 0.5s ease forwards' : undefined,
          }}
        >
          <div
            className="lw-float-in flex flex-col items-center"
            style={{
              animation: opened
                ? 'lwCoverCard 0.9s cubic-bezier(0.22,1,0.36,1) forwards'
                : 'lwCoverIn 0.8s cubic-bezier(0.22,1,0.36,1) both',
            }}
          >
            {/* ─── Envelope (artwork only — no text inside) ─── */}
            <div className="lw-float-env relative" style={{ width: 'min(20rem, 88vw)', height: '13.5rem', animation: 'lwFloat 6s ease-in-out 0.6s infinite' }}>
              {/* right fold (back triangle) */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', background: '#F0E7D6' }}
              />
              {/* left fold (back triangle) */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{ clipPath: 'polygon(0 0, 0 100%, 100% 0)', background: '#F8F1E6' }}
              />

              {/* flap — lifts open */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 origin-top"
                style={{
                  height: '70%',
                  background: '#FDF9F1',
                  clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                  borderTopLeftRadius: '1rem',
                  borderTopRightRadius: '1rem',
                  backfaceVisibility: 'hidden',
                  transition: 'transform 0.75s cubic-bezier(0.34,1.56,0.64,1)',
                  transform: opened ? 'rotateX(180deg)' : 'rotateX(0deg)',
                  zIndex: 30,
                }}
              />

              {/* wax seal — sits at the flap's point, clear of any text */}
              <div
                className="lw-seal absolute left-1/2 flex items-center justify-center border-4"
                style={{
                  width: sealDiameter,
                  height: sealDiameter,
                  top: '67%',
                  transform: 'translate(-50%, -50%)',
                  borderColor: accentColor,
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  borderRadius: '9999px',
                  color: '#fff',
                  boxShadow: '0 8px 18px -6px rgba(0,0,0,0.45)',
                  animation: 'lwSealPulse 2.4s ease-in-out infinite',
                  zIndex: 40,
                }}
              >
                <Mail size={16} />
              </div>
            </div>

            {/* ─── Names — clear, unblocked block below the envelope ─── */}
            <div className="mt-12 flex flex-col items-center px-2 text-center sm:mt-14">
              <p
                className="text-xs font-bold uppercase tracking-[4px]"
                style={{ fontFamily: titleFont, opacity: 0.85 }}
              >
                {eventName}
              </p>

              <p
                className="mt-4 flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[3px]"
                style={{ fontFamily: titleFont, opacity: 0.9 }}
              >
                <span className="h-px w-10 sm:w-14" style={{ background: 'rgba(255,255,255,0.55)' }} />
                <Heart size={14} fill={accentColor} color={accentColor} />
                <span className="h-px w-10 sm:w-14" style={{ background: 'rgba(255,255,255,0.55)' }} />
              </p>

              <h1
                className="mt-3 max-w-full break-words text-4xl leading-tight sm:text-5xl"
                style={{ fontFamily: scriptFont, color: '#fff', textShadow: '0 4px 24px rgba(0,0,0,0.28)' }}
              >
                {display}
              </h1>

              <p
                className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px]"
                style={{ fontFamily: titleFont, borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.12)' }}
              >
                {eventDate}
              </p>

              <p className="mt-6 text-sm" style={{ fontFamily: titleFont, opacity: 0.8 }}>
                {guestName}, {theme.coverSubtitle}
              </p>
            </div>

            {/* hint */}
            <p
              className="mt-8 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[3px]"
              style={{ fontFamily: titleFont, opacity: 0.9 }}
            >
              <span className="h-px w-8" style={{ background: 'rgba(255,255,255,0.5)' }} />
              {theme.coverHint}
              <span className="h-px w-8" style={{ background: 'rgba(255,255,255,0.5)' }} />
            </p>
          </div>
        </button>
      )}
    </>
  )
}