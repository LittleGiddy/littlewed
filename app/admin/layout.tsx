'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Building2, Users, UserCog, CreditCard, 
  Activity, Settings, ChevronDown, ChevronLeft, ChevronRight, LogOut,
  Menu, X, Search, Bell, User
} from 'lucide-react';
import { signOut } from 'next-auth/react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { name: 'Dashboard', href: '/admin', icon: <LayoutDashboard size={20} /> },
    { name: 'Tenants', href: '/admin/tenants', icon: <Building2 size={20} /> },
    { name: 'Users', href: '/admin/users', icon: <Users size={20} /> },
    { name: 'Staff', href: '/admin/staff', icon: <UserCog size={20} /> },
    { name: 'Transactions', href: '/admin/transactions', icon: <CreditCard size={20} /> },
    { name: 'Activity Log', href: '/admin/activity', icon: <Activity size={20} /> },
    { name: 'Settings', href: '/admin/settings', icon: <Settings size={20} /> },
  ];

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-[#F0F4F8] font-['DM_Sans']">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
      `}</style>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
          <Menu size={24} className="text-[#0D4F4F]" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/Little Wed Logo.svg" alt="LittleWed" className="h-8 w-auto" />
          <span className="font-serif font-bold text-[#0D4F4F]">Admin</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-64' : 'w-20'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} px-4 h-16 border-b border-gray-200`}>
          <div className="flex items-center gap-2">
            <img src="/Little Wed Logo.svg" alt="LittleWed" className="h-8 w-auto" />
            {sidebarOpen && <span className="font-serif font-bold text-[#0D4F4F] text-lg">Admin</span>}
          </div>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:block p-1.5 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
          <button 
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-64px)]">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                ${isActive(item.href) 
                  ? 'bg-[#0D4F4F] text-white shadow-md' 
                  : 'text-gray-600 hover:bg-gray-100'
                }
                ${!sidebarOpen && 'justify-center'}
              `}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-sm font-medium">{item.name}</span>
                  {item.badge && (
                    <span className="bg-[#E8A598] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          ))}

          {/* Logout */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full
                text-red-600 hover:bg-red-50
                ${!sidebarOpen && 'justify-center'}
              `}
            >
              <LogOut size={20} />
              {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
            </button>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className={`
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}
        pt-16 lg:pt-0
      `}>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
    </div>
  );
}