'use client';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, Calendar, Users, Mail, Settings, UserPlus, LogOut, Menu, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (status === 'loading') return <div className="p-4 text-center">Loading...</div>;
  if (!session) return null;

  const role = (session.user as any)?.role;
  const userName = (session.user as any)?.name || 'User';
  const userEmail = (session.user as any)?.email || '';

  const navItems = role === 'CLIENT' ? [
    { path: '/client/dashboard', icon: Home, label: 'Home' },
    { path: '/client/events', icon: Calendar, label: 'Events' },
    { path: '/client/guests', icon: Users, label: 'Guests' },
    { path: '/client/invitations', icon: Mail, label: 'Invitations' },
    { path: '/client/staff', icon: UserPlus, label: 'Team' },
    { path: '/client/settings', icon: Settings, label: 'Settings' },
  ] : [
    { path: '/client/staff/dashboard', icon: Home, label: 'Check‑in' },
  ];

  const NavItem = ({ item, isActive }: any) => (
    <Link href={item.path} className="group relative">
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
          isActive
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
        <span className="text-sm font-medium flex-1">{item.label}</span>
        {isActive && (
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: '#0D4F4F' }}
          />
        )}
      </div>
    </Link>
  );

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col w-64 border-r border-gray-200 bg-white transition-all duration-300 ${
          !sidebarOpen && 'md:w-20'
        }`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen && (
            <h1 className="text-lg font-semibold" style={{ color: '#0D4F4F' }}>
              LittleWed
            </h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* User Profile */}
        {sidebarOpen && (
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                style={{ backgroundColor: '#0D4F4F' }}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                <p className="text-xs text-gray-500 truncate">{userEmail}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
              return sidebarOpen ? (
                <NavItem key={item.path} item={item} isActive={isActive} />
              ) : (
                <div key={item.path} title={item.label} className="flex justify-center">
                  <Link
                    href={item.path}
                    className={`p-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="w-5 h-5" strokeWidth={1.5} />
                  </Link>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Bottom Section */}
        {sidebarOpen && (
          <div className="px-2 py-4 border-t border-gray-200 space-y-1">
            <button
              onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors group"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
              <span className="text-sm font-medium flex-1">Sign Out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40">
        <h1 className="text-lg font-semibold" style={{ color: '#0D4F4F' }}>
          LittleWed
        </h1>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {mobileOpen ? (
            <X className="w-6 h-6 text-gray-600" />
          ) : (
            <Menu className="w-6 h-6 text-gray-600" />
          )}
        </button>
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 pt-16">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sidebar */}
          <aside className="absolute left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto">
            {/* User Profile */}
            <div className="px-4 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                  style={{ backgroundColor: '#0D4F4F' }}
                >
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                  <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="px-2 py-4 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                return <NavItem key={item.path} item={item} isActive={isActive} />;
              })}
            </nav>

            {/* Bottom Section */}
            <div className="px-2 py-4 border-t border-gray-200">
              <button
                onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-sm font-medium flex-1">Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pt-16 md:pt-0">
          <div className="p-6 md:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
