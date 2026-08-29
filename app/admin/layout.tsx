'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Users, UserCog, Palette,
  LogOut, Menu, X, ChevronLeft, ChevronRight,
  Bell, Search, Coins, BarChart3, Activity, Megaphone, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import SessionRevokedGuard from '@/components/SessionRevokedGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const checkScreen = () => {
      const large = window.innerWidth >= 1024;
      setIsLargeScreen(large);
      if (!large) {
        setIsCollapsed(false);
        setSidebarOpen(false);
      }
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) { router.push('/login'); return; }
    const role = (session.user as any)?.role;
    if (role !== 'SUPER_ADMIN') { router.push('/login'); return; }
  }, [session, status, router]);

  useEffect(() => {
    if (!isLargeScreen) setSidebarOpen(false);
  }, [pathname, isLargeScreen]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#0D4B4B] rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return null;

  const user = session.user as any;
  const userName = user?.name || 'Super Admin';
  const userEmail = user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/tenants', icon: Building2, label: 'Tenants' },
    { path: '/admin/users', icon: Users, label: 'Users' },
    { path: '/admin/staff', icon: UserCog, label: 'Staff' },
    { path: '/admin/credit-requests', icon: Coins, label: 'Credit Requests' },
    { path: '/admin/logs', icon: Activity, label: 'Message Logs' },
    { path: '/admin/system-logs', icon: AlertTriangle, label: 'System Logs' },
    { path: '/admin/reports', icon: BarChart3, label: 'Reports' },
    { path: '/admin/templates', icon: Palette, label: 'Templates' },
    { path: '/admin/broadcast', icon: Megaphone, label: 'Broadcast' },
  ];

  const getPageTitle = () => {
    const match = navItems.find(item => pathname === item.path || pathname?.startsWith(item.path + '/'));
    return match ? match.label : 'Dashboard';
  };

  const effectiveCollapsed = isCollapsed && !isHovered;

  const SidebarContent = ({ isMobile = false, onClose }: { isMobile?: boolean; onClose?: () => void }) => (
    <div className={`flex flex-col h-full transition-all duration-300 ${effectiveCollapsed && !isMobile ? 'items-center' : ''}`}>
      {/* Brand */}
      <div className={`flex items-center w-full px-5 h-16 border-b border-gray-100 flex-shrink-0 ${effectiveCollapsed && !isMobile ? 'justify-center px-3' : ''}`}>
        <img src="/Little Wed Logo_.svg" alt="Little Wed" className={`h-8 w-auto object-contain flex-shrink-0 ${effectiveCollapsed && !isMobile ? '' : ''}`} />
        {isMobile && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors ml-auto">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Collapse Toggle */}
      {!isMobile && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm items-center justify-center text-gray-400 hover:text-[#0D4B4B] hover:border-[#0D4B4B]/30 transition-all z-10"
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      )}

      {/* User Profile */}
      {(!effectiveCollapsed || isMobile) && (
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50">
            <div className="w-9 h-9 rounded-full bg-[#0D4B4B] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {userInitial}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
              <p className="text-xs text-gray-400 truncate">{userEmail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 w-full overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-[#0D4B4B]/5 text-[#0D4B4B]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }
                ${effectiveCollapsed && !isMobile ? 'justify-center px-2' : ''}
              `}
            >
              <item.icon size={18} className={isActive ? 'text-[#0D4B4B]' : 'text-gray-400'} />
              {(!effectiveCollapsed || isMobile) && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="w-full px-3 py-4 border-t border-gray-100">
        <button
          onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
          className={`
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 w-full
            text-gray-400 hover:text-red-600 hover:bg-red-50
            ${effectiveCollapsed && !isMobile ? 'justify-center px-2' : ''}
          `}
        >
          <LogOut size={18} />
          {(!effectiveCollapsed || isMobile) && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-x-clip">
      <SessionRevokedGuard />
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block fixed top-0 left-0 bottom-0 bg-white border-r border-gray-200 transition-all duration-300 z-30 ${
          effectiveCollapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && !isLargeScreen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/30 z-40"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-white z-50 shadow-xl overflow-y-auto"
            >
              <SidebarContent isMobile onClose={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={`flex-1 min-h-screen min-w-0 flex flex-col transition-all duration-300 ${effectiveCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu size={20} className="text-gray-600" />
            </button>
            <h1 className="text-base font-semibold text-gray-900">{getPageTitle()}</h1>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
              <Search size={18} />
            </button>
            <NotificationBell />
            <div className="w-8 h-8 rounded-full bg-[#0D4B4B] flex items-center justify-center text-white font-semibold text-xs ml-2">
              {userInitial}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0 overflow-x-clip"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
