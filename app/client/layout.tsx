'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Calendar, Mail, Settings, UserPlus, LogOut, Info, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import IdleSessionTimeout from '@/components/IdleSessionTimeout';
import SessionRevokedGuard from '@/components/SessionRevokedGuard';
import AppAvatar from '@/components/ui/AppAvatar';
import BottomNav, { type BottomNavItem } from '@/components/ui/BottomNav';
import AppProgressIndicator from '@/components/ui/AppSpinner';
import { useReducedMotion } from '@/lib/motion';

const CLIENT_NAV: BottomNavItem[] = [
  { path: '/client/dashboard', icon: Home, label: 'Dashboard' },
  { path: '/client/events', icon: Calendar, label: 'Events' },
  { path: '/client/invitations', icon: Mail, label: 'Invitations' },
  { path: '/client/staff', icon: UserPlus, label: 'Team' },
  { path: '/client/settings', icon: Settings, label: 'Settings' },
  { path: '/client/reports', icon: BarChart3, label: 'Reports' },
  { path: '/client/about', icon: Info, label: 'About' },
];

const STAFF_NAV: BottomNavItem[] = [
  { path: '/client/staff/dashboard', icon: Home, label: 'Check‑in' },
];

type SidebarContentProps = {
  userName: string;
  userEmail: string;
  userImage: string;
  navItems: BottomNavItem[];
  pathname: string;
};

/** Declared at module scope so React does not remount it on every render. */
function SidebarContent({
  userName,
  userEmail,
  userImage,
  navItems,
  pathname,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex justify-center py-4 pb-2 mb-4">
        <img
          src="/Little Wed Logo_.svg"
          alt="Little Wed"
          className="h-14 w-auto object-contain"
        />
      </div>

      {/* User Card */}
      <div className="flex items-center gap-3 bg-brand-soft border border-brand/10 rounded-card p-3.5 mb-5">
        <AppAvatar name={userName} imageUrl={userImage} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-bold text-gray-900 truncate m-0">{userName}</p>
          <p className="text-[11.5px] text-gray-400 font-medium truncate m-0 mt-[1px]">{userEmail}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto" aria-label="Main">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              href={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex items-center gap-3 px-3.5 min-h-[44px] rounded-tap text-[13.5px] font-semibold no-underline transition-all duration-150 ease-soft ${
                isActive
                  ? 'bg-brand text-white shadow-brand-sm'
                  : 'text-gray-500 hover:bg-brand-soft hover:text-brand'
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
          className="w-full flex items-center gap-3 px-3.5 min-h-[44px] rounded-tap border-none bg-transparent text-[13.5px] font-semibold text-gray-400 cursor-pointer transition-all duration-150 ease-soft hover:bg-danger-soft hover:text-danger"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

function HamburgerIcon({ open, reduced }: { open: boolean; reduced: boolean }) {
  return (
    <div className="w-[18px] h-[14px] relative flex flex-col justify-between">
      <motion.span
        className="block w-full h-[2px] rounded-sm bg-gray-900 origin-center"
        animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.25, ease: 'easeInOut' }}
      />
      <motion.span
        className="block w-full h-[2px] rounded-sm bg-gray-900"
        animate={open ? { opacity: 0, x: -6 } : { opacity: 1, x: 0 }}
        transition={{ duration: reduced ? 0 : 0.2, ease: 'easeInOut' }}
      />
      <motion.span
        className="block w-full h-[2px] rounded-sm bg-gray-900 origin-center"
        animate={open ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.25, ease: 'easeInOut' }}
      />
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const checkScreen = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // Close the drawer on navigation. Adjusting state during render rather than in
  // an effect avoids a second commit for every route change.
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (sidebarOpen) setSidebarOpen(false);
  }

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) { router.push('/login'); return; }
    if (pathname.startsWith('/client/check-in')) return;

    const user = session.user;
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
    return <AppProgressIndicator label="Loading your workspace…" />;
  }
  if (!session) return null;

  const role = session.user?.role;
  const userName = session.user?.name || 'User';
  const userEmail = session.user?.email || '';
  const userImage = session.user?.image || '';
  const navItems = role === 'CLIENT' ? CLIENT_NAV : STAFF_NAV;
  const isCheckInStation = pathname.startsWith('/client/check-in');

  return (
    <div className="min-h-screen bg-canvas">
      {/* Auto sign-out after 30 min of inactivity (kept off live check-in stations) */}
      {!isCheckInStation && <IdleSessionTimeout />}
      <SessionRevokedGuard />

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 w-[272px] z-30 bg-white border-r border-gray-200/80 overflow-hidden transition-transform duration-300 ease-soft ${
          !desktopSidebarOpen ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full p-6 px-[18px] w-[272px]">
          <SidebarContent
            userName={userName}
            userEmail={userEmail}
            userImage={userImage}
            navItems={navItems}
            pathname={pathname}
          />
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
              transition={{ duration: reducedMotion ? 0 : 0.18 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-gray-900/45 backdrop-blur-[2px] z-40"
            />
            <motion.aside
              initial={reducedMotion ? { opacity: 0 } : { x: '-100%' }}
              animate={{ x: 0, opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { x: '-100%' }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', damping: 28, stiffness: 260 }
              }
              className="fixed inset-y-0 left-0 w-[min(300px,86vw)] z-50 bg-white shadow-elev-3 overflow-y-auto"
            >
              <div className="flex flex-col h-full p-6">
                <SidebarContent
                  userName={userName}
                  userEmail={userEmail}
                  userImage={userImage}
                  navItems={navItems}
                  pathname={pathname}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div
        className={`min-h-screen transition-[margin-left] duration-300 ease-soft lg:ml-[272px] ${
          isLargeScreen && !desktopSidebarOpen ? '!ml-0' : ''
        }`}
      >
        {/* ── Top Bar ── */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200/80 px-4 sm:px-[18px] h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={toggleSidebar}
              aria-label={isMenuOpenState ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpenState}
              className="w-11 h-11 -ml-1 rounded-tap flex items-center justify-center text-gray-900 cursor-pointer shrink-0 transition-colors duration-150 hover:bg-gray-100 active:bg-gray-200/70"
            >
              <HamburgerIcon open={isMenuOpenState} reduced={reducedMotion} />
            </button>
            <img
              src="/Little Wed Logo_.svg"
              alt="Little Wed"
              className="h-[26px] sm:h-[30px] w-auto object-contain lg:hidden"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {role !== 'STAFF' && <NotificationBell />}
            <span className="hidden sm:block text-[13px] text-gray-400 font-semibold max-w-[160px] truncate">
              {userName}
            </span>
            <AppAvatar name={userName} imageUrl={userImage} size="sm" />
          </div>
        </header>

        {/* ── Page Content ── */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
            transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
            className="px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 lg:pt-8 pb-[calc(var(--app-nav-h)+3.5rem)] lg:pb-14"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      {/* ── Mobile Tab Bar (lg and up use the sidebar) ── */}
      {!isCheckInStation ? <BottomNav items={navItems} primaryCount={4} /> : null}
    </div>
  );
}
