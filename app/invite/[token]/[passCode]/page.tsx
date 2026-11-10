import { notFound, redirect } from 'next/navigation'

export default async function LegacyBrokenInviteRedirect({
  params,
}: {
  params: Promise<{ token: string; passCode: string }>
}) {
  const { token, passCode } = await params

  if (token !== '{8}' && token !== '%7B8%7D') notFound()

  redirect(`/invite/${encodeURIComponent(passCode)}`)
}
