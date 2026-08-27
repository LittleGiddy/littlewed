'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Coins, CheckCircle, XCircle, Clock, Building2, User,
  RefreshCw, Filter, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CreditRequest {
  id: string;
  tenantId: string;
  userId: string;
  requestedCredits: number;
  amountTZS: number;
  reason: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  grantedCredits: number | null;
  createdAt: string;
  tenant: { id: string; name: string; subdomain: string };
}

interface Summary {
  status: string;
  _count: { id: number };
  _sum: { requestedCredits: number | null };
}

export default function CreditRequestsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [grantAmounts, setGrantAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session || (session.user as any)?.role !== 'SUPER_ADMIN') {
      router.push('/login');
    }
  }, [session, sessionStatus, router]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const url = filter === 'ALL'
        ? '/api/admin/credit-requests'
        : `/api/admin/credit-requests?status=${filter}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setRequests(data.requests || []);
      setSummary(data.summary || []);
    } catch {
      toast.error('Failed to load credit requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, [filter]);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    try {
      const grantedCredits = action === 'approve'
        ? parseInt(grantAmounts[requestId] || '0', 10) || undefined
        : undefined;

      const res = await fetch('/api/admin/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId, action, grantedCredits }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(action === 'approve'
          ? `Granted ${grantedCredits || 'requested'} credits`
          : 'Request rejected');
        loadRequests();
      } else {
        toast.error(data.error || 'Failed to process');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessingId(null);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'APPROVED': return 'bg-[#0D4B4B]/5 text-[#0D4B4B] border-[#0D4B4B]/20';
      case 'REJECTED': return 'bg-red-50 text-red-600 border-red-200';
      default: return 'bg-gray-50 text-gray-500 border-gray-200';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock size={13} />;
      case 'APPROVED': return <CheckCircle size={13} />;
      case 'REJECTED': return <XCircle size={13} />;
      default: return null;
    }
  };

  const getSummaryCount = (status: string) => {
    const s = summary.find((x) => x.status === status);
    return s?._count?.id ?? 0;
  };

  const getSummaryCredits = (status: string) => {
    const s = summary.find((x) => x.status === status);
    return s?._sum?.requestedCredits ?? 0;
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-[1.5px] text-[#0D4B4B] uppercase mb-1.5">
            <span className="w-[5px] h-[5px] rounded-full bg-[#FF6B5C]" />
            Admin
          </div>
          <h1 className="font-serif text-[30px] font-black text-gray-900 leading-tight tracking-tight">
            Credit <span className="text-[#FF6B5C]">Requests</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Review and grant credits to tenants.</p>
        </div>
        <button
          onClick={loadRequests}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-500 text-[13px] font-bold cursor-pointer shrink-0 transition-all hover:border-[#0D4B4B] hover:text-[#0D4B4B]"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ─── Summary Stats ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { status: 'PENDING', label: 'Pending', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100' },
          { status: 'APPROVED', label: 'Approved', icon: CheckCircle, color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5', ring: 'ring-[#0D4B4B]/10' },
          { status: 'REJECTED', label: 'Rejected', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', ring: 'ring-red-100' },
          { status: 'ALL', label: 'Total', icon: Coins, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100' },
        ].map((item) => (
          <motion.div
            key={item.status}
            whileTap={{ scale: 0.97 }}
            className="bg-white rounded-[20px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${item.bg} ${item.color} ring-1 ${item.ring}`}>
                <item.icon size={16} />
              </div>
            </div>
            <p className="font-serif text-2xl font-bold text-gray-900">
              {item.status === 'ALL' ? requests.length : getSummaryCount(item.status)}
            </p>
            <p className="text-xs font-medium text-gray-400">{item.label}</p>
            {item.status !== 'ALL' && (
              <p className="text-[11px] text-gray-400 mt-1">
                {getSummaryCredits(item.status).toLocaleString()} credits
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* ─── Filter Tabs ─── */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
              filter === f
                ? 'bg-[#0D4B4B] text-white'
                : 'bg-white text-gray-400 shadow-[0_2px_8px_rgba(20,30,45,0.05)]'
            }`}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
            <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20">
              {f === 'ALL' ? requests.length : getSummaryCount(f)}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Requests List ─── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-[20px] p-5 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-[20px] p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-[#0D4B4B]/5">
            <Coins size={28} className="text-[#0D4B4B]" />
          </div>
          <h3 className="font-serif text-lg font-bold text-gray-900 mb-1">No requests found</h3>
          <p className="text-sm text-gray-400">
            {filter === 'PENDING' ? 'No pending credit requests at the moment.' : `No ${filter.toLowerCase()} requests.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[20px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B]">
                      <Coins size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-gray-900">{req.requestedCredits} credits</h3>
                        <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${statusColor(req.status)}`}>
                          {statusIcon(req.status)}
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {req.tenant.name} ({req.tenant.subdomain})
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">
                    {new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                  <span className="flex items-center gap-1"><Building2 size={12} /> {req.tenant.name}</span>
                  <span>Amount: <strong className="text-gray-700">{req.amountTZS.toLocaleString()} TZS</strong></span>
                  {req.grantedCredits != null && (
                    <span>Granted: <strong className="text-[#0D4B4B]">{req.grantedCredits} credits</strong></span>
                  )}
                </div>

                {req.reason && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3">
                    <p className="text-xs text-gray-500"><strong>Reason:</strong> {req.reason}</p>
                  </div>
                )}

                {req.status === 'PENDING' && (
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 mr-2">
                      <span className="text-[11px] font-bold text-gray-400">Grant:</span>
                      <input
                        type="number"
                        min="1"
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-[#0D4B4B] transition-colors text-center"
                        value={grantAmounts[req.id] || req.requestedCredits}
                        onChange={(e) => setGrantAmounts((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      />
                      <span className="text-[11px] text-gray-400">credits</span>
                    </div>
                    <button
                      onClick={() => handleAction(req.id, 'approve')}
                      disabled={processingId === req.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#0D4B4B] text-white text-xs font-bold rounded-xl hover:bg-[#0A3939] transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={13} />
                      {processingId === req.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleAction(req.id, 'reject')}
                      disabled={processingId === req.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={13} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
