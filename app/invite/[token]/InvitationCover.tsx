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
 * Fancy landing cover: an envelope / invitation card splash. Tapping
 * anywhere opens the envelope then takes the guest straight to their
 * invitee page.
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

  const coverBg = headerImage
    ? `linear-gradient(160deg, ${primaryColor}E6, ${secondaryColor}E6), url('${headerImage}') center/cover`
    : `linear-gradient(160deg, ${primaryColor}, ${secondaryColor})`

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

  return (
    <>
      <style>{`
        @keyframes lwCoverCard {
          0% { transform: scale(1) rotate(0deg); opacity: 1; }
          35% { transform: scale(1.05) rotate(1.2deg); opacity: 1; }
          55% { transform: scale(1.02) rotate(-0.6deg); opacity: 1; }
          100% { transform: scale(2.7) translateY(-2vh); opacity: 0; }
        }
        @keyframes lwCoverBackdrop {
          to { opacity: 0; }
        }
        @keyframes lwCoverIn {
          from { opacity: 0; transform: translateY(26px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lwSealPulse {
          0%, 100% { box-shadow: 0 6px 16px -6px rgba(0,0,0,0.45), 0 0 0 0 rgba(255,255,255,0.4); }
          50% { box-shadow: 0 6px 16px -6px rgba(0,0,0,0.45), 0 0 0 11px rgba(255,255,255,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lw-float-in, .lw-seal { animation: none !important; }
        }
      `}</style>

      {!gone && (
        <button
          type="button"
          onClick={handleOpen}
          aria-label={theme.coverHint}
          className="fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center border-0 p-4"
          style={{
            background: coverBg,
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
                : 'lwCoverIn 0.8s cubic-bezier(0.22,1,0.36,1) both, gpFloatSoft 5s ease-in-out 0.8s infinite',
            }}
          >
            {/* ─── Envelope ─── */}
            <div
              className="relative rounded-2xl"
              style={{
                width: 'min(20rem, 88vw)',
                height: '13rem',
                background: '#fff',
                border: `1px solid ${accentColor}66`,
                boxShadow: '0 30px 60px -24px rgba(0,0,0,0.55)',
              }}
            >
              {/* right fold (back triangle) */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', background: '#F3EBDD' }}
              />
              {/* left fold (back triangle) */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{ clipPath: 'polygon(0 0, 0 100%, 100% 0)', background: '#F8F1E6' }}
              />

              {/* flap - lifts open */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 origin-top"
                style={{
                  height: '64%',
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

              {/* invitation card inside the envelope */}
              <div
                className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1.5 rounded-xl border bg-[#FFFDF8] px-4 py-3 text-center"
                style={{
                  width: '84%',
                  height: opened ? '74%' : '52%',
                  top: opened ? '12%' : '44%',
                  borderColor: `${accentColor}88`,
                  boxShadow: opened ? '0 22px 44px -20px rgba(0,0,0,0.55)' : '0 10px 22px -18px rgba(0,0,0,0.4)',
                  transition: 'top 0.75s cubic-bezier(0.22,1,0.36,1), height 0.75s cubic-bezier(0.22,1,0.36,1), box-shadow 0.75s ease',
                  zIndex: 20,
                }}
              >
                <Heart size={15} fill={accentColor} color={accentColor} />
                <p
                  className="text-[10px] font-bold uppercase tracking-[3px]"
                  style={{ color: primaryColor, opacity: 0.75 }}
                >
                  {eventName}
                </p>
                <p
                  className="max-w-full break-words text-xl sm:text-2xl leading-tight"
                  style={{ fontFamily: scriptFont, color: primaryColor }}
                >
                  {display}
                </p>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[1.5px]"
                  style={{ color: '#7A5B00', opacity: 0.8 }}
                >
                  {eventDate}
                </p>
              </div>

              {/* wax seal */}
              <div
                className="lw-seal absolute left-1/2 flex items-center justify-center border-4"
                style={{
                  width: '3rem',
                  height: '3rem',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  borderColor: accentColor,
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  borderRadius: '9999px',
                  color: '#fff',
                  boxShadow: '0 6px 16px -6px rgba(0,0,0,0.45)',
                  animation: 'lwSealPulse 2.4s ease-in-out infinite',
                  zIndex: 40,
                }}
              >
                <Mail size={15} />
              </div>
            </div>

            {/* hint */}
            <p
              className="mt-8 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[3px]"
              style={{ opacity: 0.9, fontFamily: titleFont }}
            >
              <span className="h-px w-8" style={{ background: 'rgba(255,255,255,0.5)' }} />
              {theme.coverHint}
              <span className="h-px w-8" style={{ background: 'rgba(255,255,255,0.5)' }} />
            </p>
            <p className="mt-1.5 text-xs" style={{ fontFamily: titleFont, opacity: 0.75 }}>
              {guestName}, {theme.coverSubtitle}
            </p>
          </div>
        </button>
      )}
    </>
  )
}