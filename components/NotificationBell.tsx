'use client';
import { useEffect, useState, useRef } from 'react';
import { Bell, BellOff, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: 'info' | 'success' | 'warning' | 'alert';
  link: string | null;
  createdAt: string;
  isRead: boolean;
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Only show new notifications if count changed (optional)
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  // Poll every 15 seconds
  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (notifications.length === 0) return;
    try {
      await Promise.all(notifications.map(n => 
        fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH', credentials: 'include' })
      ));
      setNotifications([]);
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'alert': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const unreadCount = notifications.length;

  if (!session) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-[#0D4F4F] hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  <BellOff className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p>All caught up!</p>
                  <p className="text-xs">No new notifications</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition flex items-start gap-3"
                    onClick={() => {
                      markAsRead(n.id);
                      if (n.link) window.location.href = n.link;
                    }}
                  >
                    <div className="mt-0.5">{getIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{n.title}</p>
                      {n.message && <p className="text-xs text-gray-500 truncate">{n.message}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-2 text-center">
                <a href="/client/notifications" className="text-xs text-[#0D4F4F] hover:underline font-medium">
                  View all notifications
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}