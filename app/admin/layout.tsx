'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Building2, Users, UserCog, CreditCard, 
  Activity, LogOut, Menu, X, ChevronLeft, ChevronRight,
  Sparkles
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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <div className="w-10 h-10 border-4 border-[#EBEEF2] border-t-[#0D4F4F] rounded-full animate-spin" />
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

  const SidebarContent = ({ isMobile = false, onClose }: { isMobile?: boolean; onClose?: () => void }) => (
    <div className={`sidebar-inner ${!isMobile && isCollapsed ? 'collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand-wrap">
        <div className="sidebar-brand-icon">
          <Sparkles size={20} className="text-[#E8A598]" />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">LittleWed</span>
          <span className="sidebar-brand-badge">Admin Panel</span>
        </div>
        {isMobile && (
          <button 
            onClick={onClose} 
            className="ml-auto p-1.5 rounded-lg hover:bg-[#F0F4F8] text-[#7A8FA6] transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {!isMobile && (
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="sidebar-collapse-btn"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      )}

      {/* User Profile */}
      <div className="sidebar-profile">
        <div className="sidebar-avatar">
          {userInitial}
          <div className="sidebar-avatar-ring" />
        </div>
        <div className="sidebar-profile-info">
          <p className="sidebar-profile-name">{userName}</p>
          <p className="sidebar-profile-email">{userEmail}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`sidebar-nav-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-nav-icon-wrap">
                <item.icon size={18} className="sidebar-nav-icon" />
              </span>
              <span className="sidebar-nav-label">{item.label}</span>
              {isActive && <span className="sidebar-nav-dot" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button onClick={() => signOut({ redirect: true, callbackUrl: '/login' })} className="sidebar-signout">
          <LogOut size={18} />
          <span className="sidebar-nav-label">Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin-layout">
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

        .admin-layout {
          min-height: 100vh;
          background: #F5F7FA;
          font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
          display: flex;
        }

        /* ─── Desktop Sidebar ─── */
        .admin-desktop-sidebar {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          z-index: 30;
          background: #ffffff;
          border-right: 1px solid #EBEEF2;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          box-shadow: 4px 0 24px rgba(0,0,0,0.02);
        }
        @media (min-width: 1024px) {
          .admin-desktop-sidebar {
            display: block;
            width: ${isCollapsed ? '76px' : '280px'};
          }
        }

        .sidebar-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 24px 16px;
          transition: padding 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar-inner.collapsed {
          padding: 24px 12px;
          align-items: center;
        }

        /* ─── Brand ─── */
        .sidebar-brand-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 20px;
          margin-bottom: 16px;
          border-bottom: 1px solid #EBEEF2;
          width: 100%;
          position: relative;
        }
        .sidebar-brand-icon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0D4F4F, #1A6B6B);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(13,79,79,0.15);
        }
        .sidebar-brand-text {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          overflow: hidden;
          white-space: nowrap;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 1;
          width: 140px;
        }
        .sidebar-inner.collapsed .sidebar-brand-text {
          opacity: 0;
          width: 0;
        }
        .sidebar-brand-name {
          font-family: 'Playfair Display', serif;
          font-size: 17px;
          font-weight: 800;
          color: #0D1B1B;
          letter-spacing: -0.3px;
        }
        .sidebar-brand-badge {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #9BAAB8;
          margin-top: 2px;
        }

        .sidebar-collapse-btn {
          position: absolute;
          right: -12px;
          top: 76px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid #EBEEF2;
          background: #ffffff;
          color: #7A8FA6;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          z-index: 20;
        }
        .sidebar-collapse-btn:hover {
          color: #0D4F4F;
          border-color: #0D4F4F;
          background: #F0F4F8;
          box-shadow: 0 4px 12px rgba(13, 79, 79, 0.1);
        }

        /* ─── Profile ─── */
        .sidebar-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          background: #F8FAFC;
          border: 1px solid #EBEEF2;
          margin-bottom: 24px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          white-space: nowrap;
          width: 100%;
        }
        .sidebar-inner.collapsed .sidebar-profile {
          padding: 8px;
          justify-content: center;
          background: transparent;
          border-color: transparent;
          width: 52px;
          align-self: center;
        }
        .sidebar-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          flex-shrink: 0;
          background: linear-gradient(135deg, #0D4F4F, #1A6B6B);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 14px;
          font-family: 'Playfair Display', serif;
          position: relative;
        }
        .sidebar-avatar-ring {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 2px solid rgba(13, 79, 79, 0.3);
          animation: ringPulse 3s ease-in-out infinite;
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0; }
        }
        .sidebar-profile-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 1;
          width: 140px;
        }
        .sidebar-inner.collapsed .sidebar-profile-info {
          opacity: 0;
          width: 0;
        }
        .sidebar-profile-name {
          font-size: 13.5px;
          font-weight: 700;
          color: #0D1B1B;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-profile-email {
          font-size: 11px;
          color: #9BAAB8;
          font-weight: 500;
          margin: 2px 0 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ─── Navigation ─── */
        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 4px 0;
        }
        .sidebar-nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          color: #5A6F82;
          text-decoration: none;
          transition: all 0.2s ease;
          position: relative;
          white-space: nowrap;
          width: 100%;
        }
        .sidebar-nav-link:hover {
          color: #0D4F4F;
          background: #F0F4F8;
        }
        .sidebar-nav-link.active {
          color: #0D4F4F;
          background: rgba(13, 79, 79, 0.08);
          font-weight: 600;
        }
        .sidebar-nav-link.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          height: 60%;
          width: 3px;
          border-radius: 0 4px 4px 0;
          background: #0D4F4F;
        }
        .sidebar-inner.collapsed .sidebar-nav-link {
          justify-content: center;
          padding: 10px;
        }
        .sidebar-nav-icon-wrap {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .sidebar-nav-link.active .sidebar-nav-icon-wrap {
          background: rgba(13, 79, 79, 0.1);
        }
        .sidebar-nav-icon {
          color: inherit;
          flex-shrink: 0;
        }
        .sidebar-nav-label, .sidebar-nav-dot {
          overflow: hidden;
          white-space: nowrap;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 1;
          width: auto;
        }
        .sidebar-inner.collapsed .sidebar-nav-label,
        .sidebar-inner.collapsed .sidebar-nav-dot {
          opacity: 0;
          width: 0;
          margin: 0;
        }
        .sidebar-nav-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #0D4F4F;
          flex-shrink: 0;
          margin-left: auto;
        }

        /* ─── Footer ─── */
        .sidebar-footer {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid #EBEEF2;
          width: 100%;
        }
        .sidebar-signout {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          background: transparent;
          font-size: 14px;
          font-weight: 500;
          color: #7A8FA6;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sidebar-signout:hover {
          color: #C0392B;
          background: #FEF2F2;
        }
        .sidebar-inner.collapsed .sidebar-signout {
          justify-content: center;
          padding: 10px;
        }

        /* ─── Scrollbar ─── */
        .sidebar-nav::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-nav::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-nav::-webkit-scrollbar-thumb {
          background: #D8DEE5;
          border-radius: 10px;
        }
        .sidebar-nav::-webkit-scrollbar-thumb:hover {
          background: #9BAAB8;
        }

        /* ─── Mobile Sidebar ─── */
        .admin-mobile-sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: min(300px, 84vw);
          z-index: 50;
          background: white;
          overflow-y: auto;
          box-shadow: 4px 0 32px rgba(0,0,0,0.08);
        }
        .admin-overlay {
          position: fixed;
          inset: 0;
          background: rgba(13, 27, 27, 0.4);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 40;
        }

        /* ─── Main Content ─── */
        .admin-main-wrap {
          min-height: 100vh;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        @media (min-width: 1024px) {
          .admin-main-wrap {
            margin-left: ${isCollapsed ? '76px' : '280px'};
            transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
        }

        .admin-topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid #EBEEF2;
          padding: 16px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .admin-topbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .admin-topbar-title {
          font-size: 20px;
          font-weight: 700;
          color: #0D1B1B;
          font-family: 'Playfair Display', serif;
          letter-spacing: -0.3px;
          margin: 0;
        }
        .admin-menu-btn {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid #EBEEF2;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0D1B1B;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .admin-menu-btn:hover {
          border-color: #0D4F4F;
          color: #0D4F4F;
          background: #F0F4F8;
        }
        @media (min-width: 1024px) {
          .admin-menu-btn {
            display: none;
          }
        }

        .admin-topbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .admin-topbar-username {
          font-size: 14px;
          color: #5A6F82;
          font-weight: 600;
          display: none;
        }
        @media (min-width: 640px) {
          .admin-topbar-username {
            display: block;
          }
        }
        .admin-topbar-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          flex-shrink: 0;
          background: linear-gradient(135deg, #0D4F4F, #1A6B6B);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Playfair Display', serif;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 8px rgba(13, 79, 79, 0.15);
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .admin-topbar-avatar:hover {
          transform: scale(1.05);
        }

        .admin-page-content {
          padding: 32px;
          flex: 1;
          max-width: 1600px;
          width: 100%;
          margin: 0 auto;
        }
        @media (max-width: 768px) {
          .admin-page-content {
            padding: 20px 16px 40px;
          }
          .admin-topbar {
            padding: 12px 16px;
          }
        }
      `}</style>

      {/* Desktop Sidebar */}
      <aside className="admin-desktop-sidebar">
        <SidebarContent isMobile={false} />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && !isLargeScreen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
              className="admin-overlay"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="admin-mobile-sidebar"
            >
              <SidebarContent isMobile={true} onClose={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="admin-main-wrap">
        <div className="admin-topbar">
          <div className="admin-topbar-left">
            <button className="admin-menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="admin-topbar-title">{getPageTitle()}</h1>
          </div>
          <div className="admin-topbar-right">
            <NotificationBell />
            <span className="admin-topbar-username">{userName}</span>
            <div className="admin-topbar-avatar" title={userName}>
              {userInitial}
            </div>
          </div>
        </div>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="admin-page-content"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}