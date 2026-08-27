'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, BellOff, CheckCircle, XCircle, Info, AlertTriangle,
  CheckCheck, Trash2, RefreshCw, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

const TYPE_STYLE: Record<string, { icon: 'success' | 'warning' | 'alert' | 'info'; cls: string; bg: string }> = {
  success: { icon: 'success', cls: 'text-green-600', bg: 'bg-green-50' },
  warning: { icon: 'warning', cls: 'text-amber-600', bg: 'bg-amber-50' },
  alert: { icon: 'alert', cls: 'text-red-600', bg: 'bg-red-50' },
  CREDIT_GRANTED: { icon: 'success', cls: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5' },
  CREDIT_REQUEST: { icon: 'warning', cls: 'text-amber-600', bg: 'bg-amber-50' },
  CREDIT_REJECTED: { icon: 'alert', cls: 'text-red-600', bg: 'bg-red-50' },
  info: { icon: 'info', cls: 'text-blue-600', bg: 'bg-blue-50' },
};

function TypeIcon({ type }: { type: string }) {
  const st = TYPE_STYLE[type]?.icon || 'info';
  switch (st) {
    case 'success': return <CheckCircle size={14} />;
    case 'warning': return <AlertTriangle size={14} />;
    case 'alert': return <XCircle size={14} />;
    default: return <Info size={14} />;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [all, setAll] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?all=1', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAll(data.notifications || []);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const unread = all.filter((n) => !n.isRead);
  const list = tab === 'unread' ? unread : all;

  const markRead = async (n: Notification) => {
    if (n.isRead) return;
    try {
      await fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH', credentials: 'include' });
      setAll((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    } catch { /* ignore */ }
  };

  const open = (n: Notification) => {
    markRead(n);
    if (n.link) router.push(n.link);
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
        credentials: 'include',
      });
      setAll((prev) => prev.map((x) => ({ ...x, isRead: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to update notifications');
    }
  };

  const clearRead = async () => {
    try {
      await fetch('/api/notifications', { method: 'DELETE', credentials: 'include' });
      setAll((prev) => prev.filter((x) => !x.isRead));
      toast.success('Cleared read notifications');
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  const tabs = [
    { key: 'all' as const, label: 'All', count: all.length },
    { key: 'unread' as const, label: 'Unread', count: unread.length },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <p className="text-[11px] font-bold tracking-[1.5px] text-[#0D4B4B] uppercase mb-1.5">Inbox</p>
          <h1 className="text-2xl sm:text-[26px] font-black text-gray-900 leading-tight">Notifications</h1>
          <p className="text-sm text-gray-400 mt-1">All your updates in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 bg-white hover:border-[#0D4B4B] hover:text-[#0D4B4B] transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {unread.length > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-[#0D4B4B] bg-white hover:bg-[#0D4B4B]/5 transition"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          {all.some((n) => n.isRead) && (
            <button
              onClick={clearRead}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-xs font-semibold text-red-600 bg-white hover:bg-red-50 transition"
            >
              <Trash2 size={13} /> Clear read
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition flex items-center gap-2 ${
              tab === t.key ? 'bg-[#0D4B4B] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#0D4B4B]/40'
            }`}
          >
            {t.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">Loading notifications...</div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <BellOff size={26} className="text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-800">All caught up</p>
            <p className="text-xs text-gray-400 mt-1">No {tab === 'unread' ? 'unread' : ''} notifications right now.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {list.map((n) => {
              const st = TYPE_STYLE[n.type] || TYPE_STYLE.info;
              return (
                <button
                  key={n.id}
                  onClick={() => open(n)}
                  className={`w-full text-left px-4 sm:px-5 py-3.5 flex items-start gap-3 transition ${
                    n.isRead ? 'bg-gray-50/30 hover:bg-gray-50' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-9 h-9 rounded-xl ${st.bg} flex items-center justify-center flex-shrink-0 mt-0.5 ${st.cls}`}>
                    <TypeIcon type={n.type} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${n.isRead ? 'text-gray-600 font-medium' : 'text-gray-900 font-bold'}`}>{n.title}</p>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-[#0D4B4B] flex-shrink-0 mt-1.5" />}
                    </div>
                    {n.message && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                  {n.link && <ChevronRight size={14} className="text-gray-300 flex-shrink-0 mt-2.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
