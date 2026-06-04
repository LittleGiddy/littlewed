'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export default function BottomNav({ items }: { items: { path: string; icon: any; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 shadow-lg z-10">
      <div className="flex justify-around py-2">
        {items.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs mt-1">{item.label}</span>
              {isActive && (
                <motion.div layoutId="activeTab" className="h-0.5 w-6 bg-indigo-600 rounded-full mt-1" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}