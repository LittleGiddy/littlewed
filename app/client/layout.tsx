'use client';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Calendar, Users, Mail, Settings, UserPlus, LogOut, Menu, X, Info } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    const checkScreen = () => {
      const large = window.innerWidth >= 1024;
      setIsLargeScreen(large);
      setSidebarOpen(large);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    if (pathname.startsWith('/client/check-in')) return;

    const user = session.user as any;
    const role = user?.role;

    if (role !== 'CLIENT' && role !== 'STAFF') {
      router.push('/login');
      return;
    }

    // Check active status for CLIENT users
    if (role === 'CLIENT' && !user.isActive && pathname !== '/client/pending-activation') {
      router.push('/client/pending-activation');
      return;
    }

    if (user.isActive && pathname === '/client/pending-activation') {
      router.push('/client/dashboard');
    }
  }, [session, status, router, pathname]);

  useEffect(() => {
    if (!isLargeScreen) setSidebarOpen(false);
  }, [pathname, isLargeScreen]);

  if (status === 'loading') return <div className="p-4 text-center">Loading...</div>;
  if (!session) return null;

  const role = (session.user as any)?.role;
  const userName = (session.user as any)?.name || 'User';
  const userEmail = (session.user as any)?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();

  const navItems = role === 'CLIENT' ? [
    { path: '/client/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/client/events', icon: Calendar, label: 'Events' },
    { path: '/client/invitations', icon: Mail, label: 'Invitations' },
    { path: '/client/staff', icon: UserPlus, label: 'Team' },
    { path: '/client/settings', icon: Settings, label: 'Settings' },
    { path: '/client/about', icon: Info, label: 'About' },
  ] : [
    { path: '/client/staff/dashboard', icon: Home, label: 'Check‑in' },
  ];

  // Reusable sidebar content
  const SidebarContent = () => (
    <div className="flex flex-col h-full p-5">
      {/* Logo */}
      <div className="mb-8 flex justify-center py-2">
        <img src="/Little Wed Logo_.svg" alt="Little Wed" className="h-14 w-auto object-contain" />
      </div>

      {/* User profile */}
      <div className="bg-gray-50 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0D4F4F] to-[#E8A598] flex items-center justify-center text-white font-semibold text-base shadow-sm">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 truncate">{userName}</p>
            <p className="text-xs text-gray-500 truncate">{userEmail}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => !isLargeScreen && setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-full transition-all duration-200 ${
                isActive
                  ? 'bg-[#0D4F4F] text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign Out – with separator and improved styling */}
      <div className="mt-auto pt-4 border-t border-gray-200">
        <button
          onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Desktop Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-72 bg-white shadow-lg z-30 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-0'}`}>
        {/* Top header */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <img
              src="/Little Wed Logo_.svg"
              alt="Little Wed"
              className="h-8 w-auto object-contain lg:hidden"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{userName}</span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0D4F4F] to-[#E8A598] flex items-center justify-center text-white text-xs font-semibold">
              {userInitial}
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {sidebarOpen && !isLargeScreen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20"
              />
              <motion.aside
                initial={{ x: '-100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '-100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 h-screen w-72 bg-white shadow-xl z-50 flex flex-col overflow-y-auto"
              >
                <SidebarContent />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Page content */}
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="p-6 lg:p-8"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}