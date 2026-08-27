'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Loader2, MessageCircle,
  Phone, RefreshCw, Search, ShieldAlert, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LogGuest {
  id: string;
  name: string;
  phone: string;
  event: { id: string; name: string; tenant: { id: string; name: string; subdomain: string } };
}

interface LogEntry {
  id: string;
  type: string;
  status: string;
  error: string | null;
  rawData: unknown;
  createdAt: string;
  guest: LogGuest | null;
}

const STATUS_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  SENT: { label: 'Sent', cls: 'bg-blue-50 text-[#0D4B4B]', dot: 'bg-[#0D4B4B]' },
  PENDING: { label: 'Pending', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  DELIVERED: { label: 'Delivered', cls: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  FAILED: { label: 'Failed', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  REJECTED: { label: 'Rejected', cls: 'bg-rose-50 text-rose-600', dot: 'bg-rose-500' },
};

const TYPE_STYLE: Record<string, { label: string; cls: string; icon: 'wa' | 'sms' }> = {
  WHATSAPP: { label: 'WhatsApp', cls: 'bg-[#0D4B4B]/5 text-[#0D4B4B]', icon: 'wa' },
  SMS: { label: 'SMS', cls: 'bg-gray-100 text-gray-600', icon: 'sms' },
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [failure24h, setFailure24h] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const loadedRef = useRef<Set<string>>(new Set());

  const failed = (summary.FAILED || 0) + (summary.REJECTED || 0);
  const delivered = summary.DELIVERED || 0;
  const sent = summary.SENT || 0;
  const pending = summary.PENDING || 0;

  const buildUrl = (cursor = '') => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterChannel) params.set('channel', filterChannel);
    if (cursor) params.set('cursor', cursor);
    params.set('take', '50');
    return `/api/admin/message-logs?${params.toString()}`;
  };

  const load = useCallback(async (reset = true) => {
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(reset ? '' : (nextCursor || '')), { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const seen = new Set<string>(loadedRef.current);
      const fresh = (data.logs as LogEntry[]).filter((l) => {
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      });
      setLogs((prev) => (reset ? fresh : [...prev, ...fresh]));
      loadedRef.current = seen;
      setSummary(data.summary || {});
      setFailure24h(data.failure24h || 0);
      setNextCursor(data.nextCursor || null);
    } catch {
      toast.error(reset ? 'Failed to load message logs' : 'Failed to load more');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterChannel, nextCursor]);

  const applyFilters = () => {
    setLogs([]);
    setNextCursor(null);
    loadedRef.current = new Set();
  };

  const refresh = () => {
    setLogs([]);
    setNextCursor(null);
    setLoading(true);
    load(true);
  };

  // Load only when filter changes
  useEffect(() => { applyFilters(); }, [filterStatus, filterChannel]);

  useEffect(() => {
    setLoading(true);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterChannel]);

  const statusBtn = (value: string, label: string, count: number | undefined, active: boolean) => (
    <button
      key={value || 'all'}
      onClick={() => setFilterStatus(value)}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 border ${
        active ? 'bg-[#0D4B4B] text-white border-[#0D4B4B]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#0D4B4B]/40'
      }`}
    >
      {label}
      {(count ?? 0) > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>}
    </button>
  );

  const cards = [
    { label: 'Failed (24h)', value: failure24h, icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', alert: failure24h > 0 },
    { label: 'Total Failed', value: failed, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50', alert: failed > 0 },
    { label: 'Delivered', value: delivered, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pending', value: pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Sent', value: sent, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-[#0D4B4B]" />
            <span className="text-xs font-bold tracking-wider text-[#0D4B4B] uppercase">Monitoring</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Message Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Track delivery and message failures across tenants to spot and fix issues.</p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-[#0D4B4B] hover:text-[#0D4B4B] transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Failure alert banner */}
      {failure24h > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {failure24h} message{failure24h > 1 ? 's' : ''} failed in the last 24 hours
            </p>
            <p className="text-xs text-red-600 mt-0.5">Review the failed logs below to identify problematic tenants, invalid numbers or API issues.</p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-2 ${c.alert ? 'animate-pulse' : ''}`}>
              <c.icon size={16} className={c.color} />
            </div>
            <p className="text-xl font-bold text-gray-900 leading-none">{c.value.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Status:</span>
        {statusBtn('', 'All', undefined, filterStatus === '')}
        {statusBtn('FAILED', 'Failed', summary.FAILED, filterStatus === 'FAILED')}
        {statusBtn('REJECTED', 'Rejected', summary.REJECTED, filterStatus === 'REJECTED')}
        {statusBtn('DELIVERED', 'Delivered', summary.DELIVERED, filterStatus === 'DELIVERED')}
        {statusBtn('PENDING', 'Pending', summary.PENDING, filterStatus === 'PENDING')}
        {statusBtn('SENT', 'Sent', summary.SENT, filterStatus === 'SENT')}
        <span className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Channel:</span>
        {[
          { v: '', l: 'All' },
          { v: 'WHATSAPP', l: 'WhatsApp' },
          { v: 'SMS', l: 'SMS' },
        ].map((ch) => (
          <button
            key={ch.v}
            onClick={() => setFilterChannel(ch.v)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
              filterChannel === ch.v ? 'bg-[#0D4B4B] text-white border-[#0D4B4B]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#0D4B4B]/40'
            }`}
          >
            {ch.l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Log entries</h2>
            <p className="text-xs text-gray-400 mt-0.5">Newest first</p>
          </div>
          <span className="text-[11px] font-bold text-[#0D4B4B] bg-[#0D4B4B]/5 px-3 py-1 rounded-full">{logs.length} shown</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr className="text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Channel</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Guest</th>
                <th className="px-5 py-3">Error</th>
                <th className="px-5 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => {
                const st = STATUS_STYLE[log.status] || { label: log.status, cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
                const ty = TYPE_STYLE[log.type] || { label: log.type, cls: 'bg-gray-100 text-gray-600', icon: 'sms' as const };
                return (
                  <tr key={log.id} className="hover:bg-gray-50/60 align-top">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${ty.cls}`}>
                        {ty.icon === 'wa' ? <MessageCircle size={12} /> : <Phone size={12} />}
                        {ty.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${st.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {log.guest?.event?.tenant ? (
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{log.guest.event.tenant.name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{log.guest.event.tenant.subdomain}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {log.guest ? (
                        <div>
                          <p className="text-sm font-medium text-gray-800">{log.guest.name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{log.guest.phone}</p>
                          <p className="text-[11px] text-gray-400">{log.guest.event?.name}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {log.error ? (
                        <p className={`text-xs ${log.status === 'FAILED' || log.status === 'REJECTED' ? 'text-red-600' : 'text-gray-600'} break-words`}>{log.error}</p>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-gray-400">
                      <Search size={18} />
                      <span className="text-sm font-medium">No message logs match this filter</span>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-gray-400">
                      <Loader2 size={18} className="animate-spin" />
                      <span className="text-sm font-medium">Loading logs...</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {nextCursor && !loading && (
          <div className="px-5 py-3 border-t border-gray-100 flex justify-center">
            <button
              onClick={() => load(false)}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-[#0D4B4B] hover:bg-[#0D4B4B]/5 transition"
            >
              {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
