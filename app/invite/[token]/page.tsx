import { notFound } from 'next/navigation'
import { getGuestFromToken } from '@/lib/inviteGuest'
import { resolveGuestPageTheme, themeCss, fontImports } from '@/lib/inviteTheme'
import InvitationCover from './InvitationCover'

function formatDateShort(date: Date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

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

  const heroBackground = theme.headerImage
    ? `linear-gradient(160deg, ${theme.primaryColor}E6, ${theme.secondaryColor}E6), url('${theme.headerImage}') center/cover`
    : `linear-gradient(160deg, ${theme.primaryColor}, ${theme.secondaryColor})`

  const guestName = [guest.title, guest.name].filter(Boolean).join(' ')

  return (
    <>
      <style>{fontImports(theme)}</style>
      <style>{themeCss(theme)}</style>
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=/invite/${token}/invitation`} />
      </noscript>

      {/* Bare background so there is never a blank flash behind the cover */}
      <div className="fixed inset-0 z-0" style={{ background: heroBackground }} />

      <InvitationCover
        token={token}
        theme={theme}
        coupleName={couple}
        eventName={event.name}
        eventDate={formatDateShort(event.date)}
        guestName={guestName}
      />
    </>
  )
}