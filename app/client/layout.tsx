'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Calendar, Users, Mail, Settings, UserPlus, LogOut, Info, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import IdleSessionTimeout from '@/components/IdleSessionTimeout';
import SessionRevokedGuard from '@/components/SessionRevokedGuard';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    const checkScreen = () => {
      const large = window.innerWidth >= 1024;
      setIsLargeScreen(large);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) { router.push('/login'); return; }
    if (pathname.startsWith('/client/check-in')) return;

    const user = session.user as any;
    const role = user?.role;

    if (role !== 'CLIENT' && role !== 'STAFF') { router.push('/login'); return; }

    if (!user.tenantId) {
      router.push('/auth/google-callback?intent=login');
      return;
    }

    if (role === 'CLIENT' && !user.isActive && pathname !== '/client/pending-activation') {
      router.push('/client/pending-activation');
      return;
    }
    if (user.isActive && pathname === '/client/pending-activation') {
      router.push('/client/dashboard');
    }
  }, [session, status, router, pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  const toggleSidebar = () => {
    if (isLargeScreen) {
      setDesktopSidebarOpen((o) => !o);
    } else {
      setSidebarOpen((o) => !o);
    }
  };

  const isMenuOpenState = isLargeScreen ? desktopSidebarOpen : sidebarOpen;

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4B4B] rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return null;

  const role = (session.user as any)?.role;
  const userName = (session.user as any)?.name || 'User';
  const userEmail = (session.user as any)?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();
  const userImage = (session.user as any)?.image || '';

  const navItems = role === 'CLIENT' ? [
    { path: '/client/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/client/events', icon: Calendar, label: 'Events' },
    { path: '/client/invitations', icon: Mail, label: 'Invitations' },
    { path: '/client/staff', icon: UserPlus, label: 'Team' },
    { path: '/client/settings', icon: Settings, label: 'Settings' },
    { path: '/client/reports', icon: BarChart3, label: 'Reports' },
    { path: '/client/about', icon: Info, label: 'About' },
  ] : [
    { path: '/client/staff/dashboard', icon: Home, label: 'Check‑in' },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex justify-center py-4 pb-2 mb-4">
        <img src="/Little Wed Logo_.svg" alt="Little Wed" className="h-14 w-auto object-contain" />
      </div>

      {/* User Card */}
      <div className="flex items-center gap-3 bg-accent-soft/40 border border-accent/8 rounded-2xl p-3.5 mb-5">
        <div className="w-[42px] h-[42px] rounded-full bg-gradient-to-br from-[#0D4B4B] to-pink-400 flex items-center justify-center text-white font-bold text-[15px] font-serif shadow-md shadow-[#0D4B4B]/20 shrink-0 overflow-hidden">
          {userImage ? (
            <img src={userImage} alt={userName} className="w-full h-full object-cover" />
          ) : (
            userInitial
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-bold text-gray-900 truncate m-0">{userName}</p>
          <p className="text-[11.5px] text-gray-400 font-medium truncate m-0 mt-[1px]">{userEmail}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-[3px] flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-3.5 py-[11px] rounded-[13px] text-[13.5px] font-semibold no-underline transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-br from-[#0D4B4B] to-[#0A3939] text-white shadow-md shadow-[#0D4B4B]/30'
                  : 'text-gray-500 hover:bg-[#0D4B4B]/[0.06] hover:text-[#0A3939]'
              }`}
            >
              <item.icon size={18} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="mt-auto pt-3.5 border-t border-gray-100">
        <button
          onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3.5 py-[11px] rounded-[13px] border-none bg-transparent text-[13.5px] font-semibold text-gray-400 font-sans cursor-pointer transition-all duration-150 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  const HamburgerIcon = () => (
    <div className="w-[18px] h-[14px] relative flex flex-col justify-between">
      <motion.span
        className="block w-full h-[2px] rounded-sm bg-gray-900 origin-center"
        animate={isMenuOpenState ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      />
      <motion.span
        className="block w-full h-[2px] rounded-sm bg-gray-900"
        animate={isMenuOpenState ? { opacity: 0, x: -6 } : { opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      />
      <motion.span
        className="block w-full h-[2px] rounded-sm bg-gray-900 origin-center"
        animate={isMenuOpenState ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Auto sign-out after 30 min of inactivity (kept off live check-in stations) */}
      {!pathname.startsWith('/client/check-in') && <IdleSessionTimeout />}
      <SessionRevokedGuard />

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 w-[272px] z-30 bg-white border-r border-gray-200 shadow-sm overflow-hidden transition-transform duration-300 ease-in-out ${
          !desktopSidebarOpen ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full p-6 px-[18px] w-[272px]">
          <SidebarContent />
        </div>
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      <AnimatePresence>
        {sidebarOpen && !isLargeScreen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-gray-900/45 backdrop-blur-[2px] z-40"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 left-0 w-[min(280px,84vw)] z-50 bg-white shadow-2xl overflow-y-auto"
            >
              <div className="flex flex-col h-full p-6">
                <SidebarContent />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div
        className={`min-h-screen transition-[margin-left] duration-300 ease-in-out lg:ml-[272px] ${
          isLargeScreen && !desktopSidebarOpen ? '!ml-0' : ''
        }`}
      >
        {/* ── Top Bar ── */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] px-4 sm:px-[18px] py-3 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <button
              onClick={toggleSidebar}
              aria-label={isMenuOpenState ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpenState}
              className="w-[38px] h-[38px] rounded-[11px] border border-gray-200 bg-white flex items-center justify-center text-gray-900 cursor-pointer shrink-0 transition-all hover:border-[#0D4B4B] hover:bg-[#0D4B4B]/[0.04]"
            >
              <HamburgerIcon />
            </button>
            <img src="/Little Wed Logo_.svg" alt="Little Wed" className="h-[30px] w-auto object-contain lg:hidden" />
          </div>

          <div className="flex items-center gap-3">
            {role !== 'STAFF' && <NotificationBell />}
            <span className="hidden sm:block text-[13px] text-gray-400 font-semibold">{userName}</span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0D4B4B] to-pink-400 flex items-center justify-center text-white text-xs font-bold font-serif shrink-0 overflow-hidden">
              {userImage ? (
                <img src={userImage} alt={userName} className="w-full h-full object-cover" />
              ) : (
                userInitial
              )}
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="p-5 sm:p-6 lg:p-8 pb-12 lg:pb-14"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
