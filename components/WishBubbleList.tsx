import { format, formatDistanceToNow } from 'date-fns';

// components/WishBubbleList.tsx
// Renders guest wishes as chat-style bubbles. Shared by the invitee page and
// the tenant RSVPs page so a wish looks the same in both places.
//
// Server component on purpose: the pages that use it are server-rendered, so
// the timestamps below are formatted on the server and need no hydration.

export interface WishBubble {
  id: string;
  /** null on seeded/demo wishes that no guest actually wrote. */
  guestId: string | null;
  guestName: string;
  message: string;
  attending: string | null;
  createdAt: Date;
}

interface Props {
  wishes: WishBubble[];
  /** The guest reading the page - their own wish is aligned right. */
  currentGuestId?: string | null;
  primaryColor: string;
  accentColor: string;
  secondaryColor?: string;
  /** 'guest' = the time of day, 'tenant' = date + time + "how long ago". */
  variant?: 'guest' | 'tenant';
}

function initialOf(name: string): string {
  const first = name.trim().split(/\s+/)[0] || '';
  return (first[0] || '?').toUpperCase();
}

const STATUS_LABEL: Record<string, string> = {
  yes: 'Attending',
  no: 'Declined',
  pending: 'Maybe',
};

const STATUS_CLASS: Record<string, string> = {
  yes: 'bg-success-soft text-success',
  no: 'bg-danger-soft text-danger',
  pending: 'bg-warn-soft text-warn',
};

export default function WishBubbleList({
  wishes,
  currentGuestId = null,
  primaryColor,
  accentColor,
  secondaryColor,
  variant = 'guest',
}: Props) {
  if (wishes.length === 0) return null;

  const isTenant = variant === 'tenant';

  return (
    <>
      {/* Self-contained so the same bubble works on pages that don't load the
          invitee page's global themeCss() block. */}
      <style>{`
        .gp-wish-pop {
          animation: gpWishPop 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes gpWishPop {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div className={`flex flex-col ${isTenant ? 'gap-3' : 'gap-4'}`}>
        {wishes.map((wish, i) => {
          const mine = currentGuestId !== null && wish.guestId === currentGuestId;

          return (
            <div
              key={wish.id}
              className={`gp-wish-pop flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}
              style={{ animationDelay: `${Math.min(i, 8) * 0.06}s` }}
            >
              {/* Avatar - only for other guests, so your own bubble reads as "you" */}
              {!mine && (
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  {initialOf(wish.guestName)}
                </span>
              )}

              <div className={`min-w-0 max-w-[82%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                {!mine && (
                  <p
                    className={`mb-1 px-1 text-xs font-bold ${isTenant ? 'text-gray-700' : ''}`}
                    style={isTenant ? undefined : { color: primaryColor }}
                  >
                    {wish.guestName}
                  </p>
                )}

                <div
                  className={`relative px-4 py-2.5 shadow-sm ${isTenant ? 'rounded-2xl rounded-bl-md' : 'rounded-2xl rounded-bl-md border border-gray-100'}`}
                  style={
                    mine
                      ? { backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor ?? primaryColor})` }
                      : { backgroundColor: '#FFFFFF' }
                  }
                >
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${mine ? 'text-white' : 'text-gray-700'}`}
                  >
                    {wish.message}
                  </p>

                  {/* Sent time, always inside the bubble like a chat message */}
                  <p
                    className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-white/75' : 'text-gray-400'}`}
                  >
                    <time dateTime={new Date(wish.createdAt).toISOString()}>
                      {isTenant
                        ? format(new Date(wish.createdAt), 'MMM d, yyyy · h:mm a')
                        : format(new Date(wish.createdAt), 'h:mm a')}
                    </time>
                    {isTenant && (
                      <span>
                        · {formatDistanceToNow(new Date(wish.createdAt), { addSuffix: true })}
                      </span>
                    )}
                  </p>
                </div>

                {isTenant && wish.attending && STATUS_LABEL[wish.attending] && (
                  <span
                    className={`mt-1 px-1 text-[10px] font-bold ${STATUS_CLASS[wish.attending] ?? ''}`}
                  >
                    {STATUS_LABEL[wish.attending]}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
