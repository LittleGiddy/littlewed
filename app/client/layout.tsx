'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) router.push('/login');
    else if (session.user?.role !== 'STAFF') router.push('/login');
  }, [session, status, router]);

  if (status === 'loading') return <div className="p-4">Loading...</div>;
  if (!session || session.user?.role !== 'STAFF') return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="p-4">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t py-2 flex justify-around">
        <a href="/client/staff/dashboard" className="text-indigo-600">Dashboard</a>
        <a href="/client/check-in" className="text-gray-600">Check‑in</a>
        <a href="/api/auth/signout" className="text-red-600">Sign out</a>
      </nav>
    </div>
  );
}