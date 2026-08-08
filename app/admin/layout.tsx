'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Building2, Users, UserCog, CreditCard, 
  Activity, LogOut, Menu, X, ChevronLeft, ChevronRight,
  Sparkles, Bell, Search, Settings, HelpCircle, ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';

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
    if (!isLargeScreen) {
      setSidebarOpen(false);
    }
  }, [pathname, isLargeScreen]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-10 h-10 border-4 border-[#E2E8F0] border-t-[#0D4F4F] rounded-full animate-spin" />
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
    { path: '/admin/transactions', icon: CreditCard, label: 'Transactions' },
    { path: '/admin/activity', icon: Activity, label: 'Activity Log' },
  ];

  const getPageTitle = () => {
    const match = navItems.find(item => pathname === item.path || pathname?.startsWith(item.path + '/'));
    return match ? match.label : 'Dashboard';
  };

  const effectiveCollapsed = isCollapsed && !isHovered;

  const SidebarContent = ({ isMobile = false, onClose }: { isMobile?: boolean; onClose?: () => void }) => (
    <div className={`flex flex-col h-full p-4 transition-all duration-300 ${effectiveCollapsed && !isMobile ? 'items-center px-3' : ''}`}>
      {/* ─── Brand ─── */}
      <div className={`flex items-center ${effectiveCollapsed && !isMobile ? 'justify-center' : 'gap-3'} w-full pb-5 mb-4 border-b border-[#EEF2F6] relative`}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0D4F4F] to-[#1A6B6B] flex items-center justify-center shadow-lg shadow-[#0D4F4F]/20 flex-shrink-0">
          <Sparkles size={20} className="text-white" />
        </div>
        {(!effectiveCollapsed || isMobile) && (
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-bold text-[#0D1B1B] text-base tracking-tight">LittleWed</span>
            <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Admin Panel</span>
          </div>
        )}
        {isMobile && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors ml-auto">
            <X size={18} />
          </button>
        )}
      </div>

      {/* ─── Collapse Toggle ─── */}
      {!isMobile && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-3 top-[72px] w-6 h-6 rounded-full bg-white border border-[#EEF2F6] shadow-md items-center justify-center text-[#94A3B8] hover:text-[#0D4F4F] hover:border-[#0D4F4F] transition-all z-10"
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      )}

      {/* ─── User Profile ─── */}
      <div className={`flex items-center ${effectiveCollapsed && !isMobile ? 'justify-center' : 'gap-3'} w-full p-3 rounded-xl bg-[#F8FAFC] border border-[#EEF2F6] mb-5 transition-all`}>
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0D4F4F] to-[#1A6B6B] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {userInitial}
          </div>
          <div className="absolute -inset-0.5 rounded-full border-2 border-[#0D4F4F]/20 animate-pulse" />
        </div>
        {(!effectiveCollapsed || isMobile) && (
          <div className="flex flex-col flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0D1B1B] truncate">{userName}</p>
            <p className="text-[10px] text-[#94A3B8] truncate">{userEmail}</p>
          </div>
        )}
      </div>

      {/* ─── Navigation ─── */}
      <nav className="flex-1 w-full space-y-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'bg-[#0D4F4F] text-white shadow-md shadow-[#0D4F4F]/20' 
                  : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0D4F4F]'
                }
                ${effectiveCollapsed && !isMobile ? 'justify-center px-2' : ''}
              `}
            >
              <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-[#94A3B8]'} ${isActive && 'group-hover:text-white'}`}>
                <item.icon size={18} />
              </span>
              {(!effectiveCollapsed || isMobile) && (
                <>
                  <span className={`text-sm font-medium flex-1 ${isActive ? 'text-white' : ''}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white/80 flex-shrink-0" />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ─── Footer ─── */}
      <div className="w-full pt-4 mt-2 border-t border-[#EEF2F6]">
        <button
          onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full
            text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2]
            ${effectiveCollapsed && !isMobile ? 'justify-center px-2' : ''}
          `}
        >
          <LogOut size={18} />
          {(!effectiveCollapsed || isMobile) && (
            <span className="text-sm font-medium">Sign Out</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans antialiased">
      {/* ─── Desktop Sidebar ─── */}
      <aside 
        className={`hidden lg:block fixed top-0 left-0 bottom-0 bg-white border-r border-[#EEF2F6] shadow-sm transition-all duration-300 z-30 ${
          effectiveCollapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <SidebarContent />
      </aside>

      {/* ─── Mobile Sidebar ─── */}
      <AnimatePresence>
        {sidebarOpen && !isLargeScreen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed left-0 top-0 bottom-0 w-[300px] bg-white z-50 shadow-2xl overflow-y-auto"
            >
              <SidebarContent isMobile onClose={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── Main Content ─── */}
      <div className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${effectiveCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'}`}>
        {/* ─── Top Bar ─── */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-[#EEF2F6] px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-[#F1F5F9] transition-colors"
            >
              <Menu size={20} className="text-[#0D1B1B]" />
            </button>
            <h1 className="text-lg font-semibold text-[#0D1B1B]">{getPageTitle()}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-xl hover:bg-[#F1F5F9] transition-colors text-[#64748B] hover:text-[#0D4F4F]">
              <Search size={18} />
            </button>
            <NotificationBell />
            <div className="flex items-center gap-2 pl-2 border-l border-[#EEF2F6]">
              <span className="text-sm font-medium text-[#64748B] hidden sm:block">{userName}</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0D4F4F] to-[#1A6B6B] flex items-center justify-center text-white font-bold text-xs shadow-sm">
                {userInitial}
              </div>
            </div>
          </div>
        </header>

        {/* ─── Page Content ─── */}
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}