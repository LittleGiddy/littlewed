'use client';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Calendar, Users, Mail, Settings, UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    const role = (session.user as any)?.role;
    if (role !== 'CLIENT' && role !== 'STAFF') {
      router.push('/login');
    }
  }, [session, status, router]);

  if (status === 'loading') return <div className="p-4 text-center">Loading...</div>;
  if (!session) return null;

  const role = (session.user as any)?.role;
  const navItems = role === 'CLIENT' ? [
    { path: '/client/dashboard', icon: Home, label: 'Home' },
    { path: '/client/events', icon: Calendar, label: 'Events' },
    { path: '/client/guests', icon: Users, label: 'Guests' },
    { path: '/client/invitations', icon: Mail, label: 'Invite' },
    { path: '/client/staff', icon: UserPlus, label: 'Staff' },
    { path: '/client/settings', icon: Settings, label: 'Settings' },
  ] : [
    { path: '/client/staff/dashboard', icon: Home, label: 'Home' },
    { path: '/client/check-in', icon: Mail, label: 'Check‑in' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="p-4"
        >
          {children}
        </motion.main>
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 shadow-lg z-10">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs mt-1">{item.label}</span>
                {isActive && <motion.div layoutId="activeTab" className="h-0.5 w-6 bg-indigo-600 rounded-full mt-1" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}