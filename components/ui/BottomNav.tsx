'use client';

import { useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { useReducedMotion } from '@/lib/motion';
import AppBottomSheet from './AppBottomSheet';

export type BottomNavItem = {
  path: string;
  icon: ComponentType<{ size?: number | string; className?: string; strokeWidth?: number }>;
  label: string;
};

/**
 * Mobile tab bar, shown only below the `lg` breakpoint where the sidebar
 * drawer takes over.
 *
 * All destinations stay reachable: the first four appear as tabs and the
 * remainder open in a "More" sheet, so no nav entry is dropped. The reserved
 * height is published as `--app-nav-h` in globals.css, which pages with their
 * own sticky action bar use to sit above this bar.
 */
export default function BottomNav({
  items,
  primaryCount = 4,
}: {
  items: BottomNavItem[];
  /** How many items fit comfortably as tabs (4 is the safe maximum). */
  primaryCount?: number;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const reduced = useReducedMotion();

  if (items.length === 0) return null;

  const isActive = (path: string) =>
    pathname === path || (pathname.startsWith(`${path}/`) && path !== '/client/dashboard');

  const primary = items.slice(0, primaryCount);
  const overflow = items.slice(primaryCount);
  const overflowActive = overflow.some((item) => isActive(item.path));

  return (
    <>
      <nav
        aria-label="Primary"
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200/80"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ul className="flex items-stretch h-[60px]">
          {primary.map((item) => {
            const active = isActive(item.path);
            return (
              <li key={item.path} className="flex-1">
                <Link
                  href={item.path}
                  aria-current={active ? 'page' : undefined}
                  className="group flex flex-col items-center justify-center gap-1 h-full no-underline transition-colors duration-150"
                >
                  <span className="relative grid place-items-center h-7 w-12 rounded-full">
                    {active ? (
                      <motion.span
                        layoutId="bottom-nav-pill"
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full bg-brand/10"
                        transition={
                          reduced ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 360 }
                        }
                      />
                    ) : null}
                    <item.icon
                      size={21}
                      strokeWidth={active ? 2.25 : 1.9}
                      className={`relative z-10 transition-colors duration-150 ${
                        active ? 'text-brand' : 'text-gray-400 group-hover:text-gray-600'
                      }`}
                    />
                  </span>
                  <span
                    className={`relative z-10 text-[10.5px] font-semibold leading-none tracking-tight transition-colors duration-150 ${
                      active ? 'text-brand' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}

          {overflow.length > 0 ? (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                className="group flex flex-col items-center justify-center gap-1 h-full w-full transition-colors duration-150"
              >
                <span className="relative grid place-items-center h-7 w-12 rounded-full">
                  {overflowActive ? (
                    <span aria-hidden="true" className="absolute inset-0 rounded-full bg-brand/10" />
                  ) : null}
                  <MoreHorizontal
                    size={21}
                    strokeWidth={1.9}
                    className={`relative z-10 transition-colors ${
                      overflowActive ? 'text-brand' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  />
                </span>
                <span
                  className={`relative z-10 text-[10.5px] font-semibold leading-none tracking-tight transition-colors ${
                    overflowActive ? 'text-brand' : 'text-gray-400 group-hover:text-gray-600'
                  }`}
                >
                  More
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      <AppBottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
        description="Everything else in your workspace."
      >
        <ul className="space-y-1 -mx-1">
          {overflow.map((item) => {
            const active = isActive(item.path);
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3.5 px-3 min-h-[52px] rounded-tap no-underline transition-colors duration-150 ${
                    active ? 'bg-brand-soft text-brand' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`grid place-items-center w-9 h-9 rounded-tap shrink-0 ${
                      active ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <item.icon size={18} />
                  </span>
                  <span className="text-[15px] font-semibold">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </AppBottomSheet>
    </>
  );
}
