'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Loader2, RefreshCw,
  Search, ShieldAlert, Tag, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SystemLogTenant {
  id: string;
  name: string;
  subdomain: string;
}

interface SystemLogEntry {
  id: string;
  type: string;
  level: string;
  message: string;
  details: unknown;
  createdAt: string;
  tenant: SystemLogTenant | null;
}

const LEVEL_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  ERROR: { label: 'Error', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  WARN: { label: 'Warning', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  INFO: { label: 'Info', cls: 'bg-blue-50 text-[#0D4B4B]', dot: 'bg-[#0D4B4B]' },
};

const TYPE_STYLE: Record<string, { label: string; cls: string }> = {
  card_generation: { label: 'Card Generation', cls: 'bg-violet-50 text-violet-700' },
  send: { label: 'Send', cls: 'bg-rose-50 text-rose-600' },
  technical: { label: 'Technical', cls: 'bg-gray-100 text-gray-600' },
};

export default function AdminSystemLogsPage() {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [summaries, setSummaries] = useState<Record<string, number>>({});
  const [failure24h, setFailure24h] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const loadedRef = useRef<Set<string>>(new Set());

  const failureCount =
    (summaries.card_generation || 0) + (summaries.send || 0) + (summaries.technical || 0);

  const buildUrl = (cursor = '') => {
    const params = new URLSearchParams();
    if (filterType) params.set('type', filterType);
    if (filterLevel) params.set('level', filterLevel);
    if (cursor) params.set('cursor', cursor);
    params.set('take', '50');
    return `/api/admin/system-logs?${params.toString()}`;
  };

  const load = useCallback(async (reset = true) => {
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(reset ? '' : (nextCursor || '')), { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const seen = new Set<string>(loadedRef.current);
      const fresh = (data.logs as SystemLogEntry[]).filter((l) => {
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      });
      setLogs((prev) => (reset ? fresh : [...prev, ...fresh]));
      loadedRef.current = seen;
      setSummaries(data.summaries || {});
      setFailure24h(data.failure24h || 0);
      setNextCursor(data.nextCursor || null);
    } catch {
      toast.error(reset ? 'Failed to load system logs' : 'Failed to load more');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterLevel, nextCursor]);

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

  useEffect(() => { applyFilters(); }, [filterType, filterLevel]);

  useEffect(() => {
    setLoading(true);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterLevel]);

  const chip = (value: string, label: string, active: boolean, onClick: () => void, count?: number) => (
    <button
      key={value || label}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 border ${
        active ? 'bg-[#0D4B4B] text-white border-[#0D4B4B]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#0D4B4B]/40'
      }`}
    >
      {label}
      {(count ?? 0) > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>}
    </button>
  );

  const cards = [
    { label: 'Failures (24h)', value: failure24h, icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', alert: failure24h > 0 },
    { label: 'Card Generation', value: summaries.card_generation || 0, icon: Tag, color: 'text-violet-600', bg: 'bg-violet-50', alert: (summaries.card_generation || 0) > 0 },
    { label: 'Send Failures', value: summaries.send || 0, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50', alert: (summaries.send || 0) > 0 },
    { label: 'Total Failures', value: failureCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', alert: failureCount > 0 },
    { label: 'Total Logs', value: Object.values(summaries).reduce((a, b) => a + b, 0), icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
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
          <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Card generation and send failures across all tenants - for spotting technical issues.</p>
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
              {failure24h} technical failure{failure24h > 1 ? 's' : ''} in the last 24 hours
            </p>
            <p className="text-xs text-red-600 mt-0.5">Review the logs below to identify card generation problems, provider issues or affected tenants.</p>
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
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Type:</span>
        {chip('', 'All', filterType === '', () => setFilterType(''), Object.values(summaries).reduce((a, b) => a + b, 0))}
        {chip('card_generation', 'Card Generation', filterType === 'card_generation', () => setFilterType('card_generation'), summaries.card_generation)}
        {chip('send', 'Send', filterType === 'send', () => setFilterType('send'), summaries.send)}
        {chip('technical', 'Technical', filterType === 'technical', () => setFilterType('technical'), summaries.technical)}
        <span className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Level:</span>
        {chip('', 'All', filterLevel === '', () => setFilterLevel(''))}
        {chip('ERROR', 'Error', filterLevel === 'ERROR', () => setFilterLevel('ERROR'))}
        {chip('WARN', 'Warning', filterLevel === 'WARN', () => setFilterLevel('WARN'))}
        {chip('INFO', 'Info', filterLevel === 'INFO', () => setFilterLevel('INFO'))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Log entries</h2>
            <p className="text-xs text-gray-400 mt-0.5">Newest first</p>
          </div>
          <div className="flex items-center gap-2">
            {summaries.card_generation > 0 && (
              <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-3 py-1 rounded-full">{summaries.card_generation} card failures</span>
            )}
            <span className="text-[11px] font-bold text-[#0D4B4B] bg-[#0D4B4B]/5 px-3 py-1 rounded-full">{logs.length} shown</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr className="text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Level</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Message</th>
                <th className="px-5 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => {
                const lv = LEVEL_STYLE[log.level] || { label: log.level, cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
                const ty = TYPE_STYLE[log.type] || { label: log.type, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={log.id} className="hover:bg-gray-50/60 align-top">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${lv.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${lv.dot}`} />
                        {lv.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg ${ty.cls}`}>
                        {ty.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {log.tenant ? (
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{log.tenant.name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{log.tenant.subdomain}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className={`text-xs ${log.level === 'ERROR' ? 'text-red-600' : log.level === 'WARN' ? 'text-amber-700' : 'text-gray-600'} break-words`}>
                        {log.message}
                      </p>
                      {(log.details !== undefined && log.details !== null) && (
                        <pre className="mt-1 text-[10px] text-gray-400 font-mono whitespace-pre-wrap max-w-md overflow-hidden">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                        </pre>
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
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-gray-400">
                      <Search size={18} />
                      <span className="text-sm font-medium">No system logs match this filter</span>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
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

      {/* Note */}
      <div className="flex items-start gap-2 text-xs text-gray-400">
        <CheckCircle2 size={14} className="text-gray-300 flex-shrink-0 mt-0.5" />
        <p>
          System logs capture card generation and send failures that don&apos;t reach Message Logs.
          Message delivery failures (per provider callback) are tracked separately under Message Logs.
        </p>
      </div>
    </div>
  );
}