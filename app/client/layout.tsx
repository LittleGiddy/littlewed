'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Calendar, Users, Mail, Settings, UserPlus, LogOut, Menu, X, Info } from 'lucide-react';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';

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

    if (role === 'CLIENT' && !user.isActive && pathname !== '/client/pending-activation') {
      router.push('/client/pending-activation');
      return;
    }
    if (user.isActive && pathname === '/client/pending-activation') {
      router.push('/client/dashboard');
    }
  }, [session, status, router, pathname]);

  // Close mobile drawer on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4F8' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #E2EAF0', borderTopColor: '#0D4F4F', borderRadius: '50%', animation: 'cl-spin 0.8s linear infinite' }} />
        <style>{`@keyframes cl-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
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

  const SidebarContent = () => (
    <div className="cl-sidebar-inner">
      <div className="cl-logo-wrap">
        <img src="/Little Wed Logo_.svg" alt="Little Wed" className="cl-logo" />
      </div>

      <div className="cl-user-card">
        <div className="cl-avatar">{userInitial}</div>
        <div className="cl-user-info">
          <p className="cl-user-name">{userName}</p>
          <p className="cl-user-email">{userEmail}</p>
        </div>
      </div>

      <nav className="cl-nav">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`cl-nav-link${isActive ? ' active' : ''}`}
            >
              <item.icon size={18} className="cl-nav-icon" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="cl-sidebar-footer">
        <button onClick={() => signOut({ redirect: true, callbackUrl: '/login' })} className="cl-signout-btn">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="cl-layout">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .cl-layout {
          min-height: 100vh;
          background: #F0F4F8;
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
        }

        /* ── Desktop sidebar (always in DOM at lg+, fixed) ── */
        .cl-desktop-sidebar {
          display: none;
        }
        @media (min-width: 1024px) {
          .cl-desktop-sidebar {
            display: block;
            position: fixed; left: 0; top: 0; bottom: 0;
            width: 272px; z-index: 30;
            background: white;
            border-right: 1.5px solid #E2EAF0;
            box-shadow: 2px 0 12px rgba(0,0,0,0.03);
          }
        }

        .cl-sidebar-inner {
          display: flex; flex-direction: column; height: 100%;
          padding: 24px 18px;
        }

        .cl-logo-wrap {
          display: flex; justify-content: center; padding: 8px 0 4px;
          margin-bottom: 24px;
        }
        .cl-logo { height: 52px; width: auto; object-fit: contain; max-width: 100%; }

        /* User card */
        .cl-user-card {
          display: flex; align-items: center; gap: 12px;
          background: rgba(13,79,79,0.04); border: 1.5px solid rgba(13,79,79,0.08);
          border-radius: 16px; padding: 14px; margin-bottom: 22px;
        }
        .cl-avatar {
          width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #0D4F4F, #E8A598);
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 800; font-size: 15px;
          font-family: 'Playfair Display', serif;
          box-shadow: 0 2px 6px rgba(13,79,79,0.2);
        }
        .cl-user-info { flex: 1; min-width: 0; }
        .cl-user-name { font-size: 13.5px; font-weight: 700; color: #0D1B1B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
        .cl-user-email { font-size: 11.5px; color: #9BAAB8; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 1px 0 0; }

        /* Nav */
        .cl-nav { flex: 1; display: flex; flex-direction: column; gap: 3px; overflow-y: auto; }
        .cl-nav-link {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 14px; border-radius: 13px;
          font-size: 13.5px; font-weight: 600; color: #4A6072;
          text-decoration: none; transition: background 0.15s, color 0.15s;
        }
        .cl-nav-link:hover { background: rgba(13,79,79,0.05); color: #0D4F4F; }
        .cl-nav-link.active {
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white;
          box-shadow: 0 3px 10px rgba(13,79,79,0.3);
        }
        .cl-nav-icon { flex-shrink: 0; }
        .cl-nav-link.active .cl-nav-icon { color: white; }

        /* Footer */
        .cl-sidebar-footer { margin-top: auto; padding-top: 14px; border-top: 1.5px solid #F0F4F8; }
        .cl-signout-btn {
          width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 11px 14px; border-radius: 13px; border: none; background: transparent;
          font-size: 13.5px; font-weight: 600; color: #9BAAB8; font-family: inherit;
          cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .cl-signout-btn:hover { background: #FEF2F2; color: #C0392B; }

        /* ── Mobile drawer ── */
        .cl-mobile-sidebar {
          position: fixed; left: 0; top: 0; bottom: 0;
          width: min(280px, 84vw); z-index: 50;
          background: white;
          box-shadow: 8px 0 32px rgba(0,0,0,0.15);
          overflow-y: auto;
        }
        .cl-overlay {
          position: fixed; inset: 0; background: rgba(13,27,27,0.45);
          backdrop-filter: blur(2px); z-index: 40;
        }

        /* ── Main content area ── */
        .cl-main-wrap {
          min-height: 100vh;
        }
        @media (min-width: 1024px) {
          .cl-main-wrap { margin-left: 272px; }
        }

        /* Top header */
        .cl-topbar {
          position: sticky; top: 0; z-index: 20;
          background: white; border-bottom: 1.5px solid #E2EAF0;
          padding: 12px 18px;
          display: flex; align-items: center; justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }
        .cl-topbar-left { display: flex; align-items: center; gap: 14px; }

        .cl-menu-btn {
          width: 38px; height: 38px; border-radius: 11px;
          border: 1.5px solid #E2EAF0; background: white;
          display: flex; align-items: center; justify-content: center;
          color: #0D1B1B; cursor: pointer; flex-shrink: 0;
          transition: border-color 0.15s, background 0.15s;
        }
        .cl-menu-btn:hover { border-color: #0D4F4F; background: rgba(13,79,79,0.04); }
        @media (min-width: 1024px) {
          .cl-menu-btn { display: none; }
        }

        .cl-topbar-logo { height: 30px; width: auto; object-fit: contain; }
        @media (min-width: 1024px) {
          .cl-topbar-logo { display: none; }
        }

        .cl-topbar-right { display: flex; align-items: center; gap: 12px; }
        .cl-topbar-username { font-size: 13px; color: #7A8FA6; font-weight: 600; display: none; }
        @media (min-width: 640px) {
          .cl-topbar-username { display: block; }
        }
        .cl-topbar-avatar {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #0D4F4F, #E8A598);
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 12px; font-weight: 800;
          font-family: 'Playfair Display', serif;
        }

        /* Page content */
        .cl-page-content { padding: 24px 18px 48px; }
        @media (min-width: 1024px) {
          .cl-page-content { padding: 32px 32px 56px; }
        }
      `}</style>

      {/* Desktop sidebar — always visible at lg+, never overlaps mobile drawer */}
      <aside className="cl-desktop-sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile drawer — only rendered/animated when toggled, and only below lg */}
      <AnimatePresence>
        {sidebarOpen && !isLargeScreen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSidebarOpen(false)}
              className="cl-overlay"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="cl-mobile-sidebar"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content — margin-left only at lg+, drawer overlays rather than pushing on mobile */}
      <div className="cl-main-wrap">
        <div className="cl-topbar">
          <div className="cl-topbar-left">
            <button className="cl-menu-btn" onClick={() => setSidebarOpen(o => !o)}>
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <img src="/Little Wed Logo_.svg" alt="Little Wed" className="cl-topbar-logo" />
          </div>

          <div className="cl-topbar-right">
            <NotificationBell />
            <span className="cl-topbar-username">{userName}</span>
            <div className="cl-topbar-avatar">{userInitial}</div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="cl-page-content"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}