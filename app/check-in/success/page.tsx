// app/check-in/success/page.tsx
// Landing page for the native <form> POST in app/invite/preview/[guestId],
// which the API redirects to after a guestId-based check-in.
import Link from 'next/link';
import { CircleCheck } from 'lucide-react';

export default async function CheckInSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-10 text-center">
        <CircleCheck size={56} className="mx-auto text-success" aria-hidden="true" />
        <h1 className="mt-5 text-2xl font-bold text-gray-800">You&apos;re checked in</h1>
        <p className="mt-2 text-gray-600">
          {name ? (
            <>
              Welcome, <span className="font-semibold">{name}</span>!
            </>
          ) : (
            'Your card has been accepted.'
          )}
        </p>
        <p className="mt-6 text-sm text-gray-500">Please keep this screen for the event staff.</p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-brandbg px-6 py-3 font-semibold text-white transition hover:bg-brand-deepbg"
        >
          Done
        </Link>
      </div>
    </div>
  );
}
