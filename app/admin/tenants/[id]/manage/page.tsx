'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, PlusCircle, TrendingUp, Calendar, Users, ArrowLeft, Trash2, RefreshCw, Shield } from 'lucide-react';
import Link from 'next/link';

export default function ManageTenantPage() {
  const { id } = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(false);
  const [testModeLoading, setTestModeLoading] = useState(false); // ✅ added
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchTenant = async () => {
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTenant(data);
      setError('');
    } catch (err) {
      setError('Could not load tenant data');
    }
  };

  useEffect(() => {
    fetchTenant();
  }, [id]);

  const toggleStatus = async () => {
    setStatusLoading(true);
    setError('');
    setSuccess('');
    const newStatus = tenant.subscriptionStatus === 'active' ? 'inactive' : 'active';
    const res = await fetch(`/api/admin/tenants/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
      credentials: 'include',
    });
    if (res.ok) {
      setTenant({ ...tenant, subscriptionStatus: newStatus });
      setSuccess(`Tenant ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
    } else {
      const err = await res.json();
      setError(err.error || 'Failed to update status');
    }
    setStatusLoading(false);
  };

  const toggleBypassPayment = async () => {
    setBypassLoading(true);
    setError('');
    setSuccess('');
    const newBypass = !tenant.bypassPayment;
    const res = await fetch(`/api/admin/tenants/${id}/bypass-payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bypassPayment: newBypass }),
      credentials: 'include',
    });
    if (res.ok) {
      setTenant({ ...tenant, bypassPayment: newBypass });
      setSuccess(`Payment bypass ${newBypass ? 'enabled' : 'disabled'} for this tenant`);
    } else {
      const err = await res.json();
      setError(err.error || 'Failed to update bypass setting');
    }
    setBypassLoading(false);
  };

  // ✅ Test mode toggle
  const toggleTestMode = async () => {
    setTestModeLoading(true);
    setError('');
    setSuccess('');
    const newTestMode = !tenant.testMode;
    const res = await fetch(`/api/admin/tenants/${id}/test-mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testMode: newTestMode }),
      credentials: 'include',
    });
    if (res.ok) {
      setTenant({ ...tenant, testMode: newTestMode });
      setSuccess(`Test mode ${newTestMode ? 'enabled' : 'disabled'} for this tenant`);
    } else {
      const err = await res.json();
      setError(err.error || 'Failed to update test mode');
    }
    setTestModeLoading(false);
  };

  const addEventCredits = async () => {
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid number of event credits');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    const res = await fetch(`/api/admin/tenants/${id}/event-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
      credentials: 'include',
    });
    if (res.ok) {
      setTenant({ ...tenant, credits: (tenant.credits || 0) + amount });
      setCreditAmount('');
      setSuccess(`Added ${amount} event credits`);
    } else {
      const err = await res.json();
      setError(err.error || 'Failed to add credits');
    }
    setLoading(false);
  };

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0D4F4F] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500">Loading tenant information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
      `}</style>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-xl px-4 py-2 hover:bg-[rgba(13,79,79,0.14)] transition"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <button onClick={fetchTenant} className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl px-4 py-2 hover:bg-gray-50 transition">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="mb-8">
          <div className="text-[11px] font-bold tracking-wider text-[#0D4F4F] uppercase mb-2">Super Admin</div>
          <h1 className="font-serif text-3xl md:text-4xl font-black text-gray-900">Manage <span className="text-[#0D4F4F]">{tenant.name}</span></h1>
          <p className="text-gray-500 text-sm mt-2">Subscription, bypass payment, and event credits</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
            <XCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
            <CheckCircle size={16} /> {success}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Subscription Status Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(13,79,79,0.1)] flex items-center justify-center text-[#0D4F4F]"><TrendingUp size={20} /></div>
                <h2 className="font-serif text-xl font-bold text-gray-800">Subscription</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="text-gray-500 text-sm">Current status</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${tenant.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {tenant.subscriptionStatus === 'active' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {tenant.subscriptionStatus === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button onClick={toggleStatus} disabled={statusLoading} className={`w-full py-2.5 rounded-xl font-semibold text-sm transition ${tenant.subscriptionStatus === 'active' ? 'bg-red-500 hover:bg-red-600 text-white shadow-md' : 'bg-[#0D4F4F] hover:bg-[#0A3D3D] text-white shadow-md'}`}>
                  {statusLoading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mx-auto" /> : tenant.subscriptionStatus === 'active' ? 'Deactivate Tenant' : 'Activate Tenant'}
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">Inactive tenants cannot create new events or access the platform.</p>
              </div>
            </div>
          </motion.div>

          {/* Test Mode Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(13,79,79,0.1)] flex items-center justify-center text-[#0D4F4F]">
                  <Shield size={20} />
                </div>
                <h2 className="font-serif text-xl font-bold text-gray-800">Test Mode</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="text-gray-500 text-sm">Card preview & test check‑in</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${tenant.testMode ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {tenant.testMode ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {tenant.testMode ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <button
                  onClick={toggleTestMode}
                  disabled={testModeLoading}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm transition bg-[#0D4F4F] hover:bg-[#0A3D3D] text-white shadow-md"
                >
                  {testModeLoading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mx-auto" /> : tenant.testMode ? 'Disable Test Mode' : 'Enable Test Mode'}
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">
                  When enabled, tenants can preview guest cards and test check‑in without sending real invitations.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bypass Payment Card */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(13,79,79,0.1)] flex items-center justify-center text-[#0D4F4F]"><Shield size={20} /></div>
                <h2 className="font-serif text-xl font-bold text-gray-800">Payment Bypass</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="text-gray-500 text-sm">Bypass payment restrictions</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${tenant.bypassPayment ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {tenant.bypassPayment ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {tenant.bypassPayment ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <button onClick={toggleBypassPayment} disabled={bypassLoading} className="w-full py-2.5 rounded-xl font-semibold text-sm transition bg-[#0D4F4F] hover:bg-[#0A3D3D] text-white shadow-md">
                  {bypassLoading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mx-auto" /> : tenant.bypassPayment ? 'Disable Bypass' : 'Enable Bypass'}
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">When enabled, the tenant can create events without any payment (no Stripe/ClickPesa). Perfect for testing or free plans.</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Event Credits Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[rgba(13,79,79,0.1)] flex items-center justify-center text-[#0D4F4F]"><Calendar size={20} /></div>
              <h2 className="font-serif text-xl font-bold text-gray-800">Event Credits</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-gray-500 text-sm">Available credits</span>
                <span className="text-2xl font-bold text-[#0D4F4F]">{tenant.credits ?? 0}</span>
              </div>
              <div className="flex gap-2">
                <input type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="Number of credits" className="flex-1 p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4F4F]/20 focus:border-[#0D4F4F]" />
                <button onClick={addEventCredits} disabled={loading} className="bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition flex items-center gap-2">
                  {loading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <><PlusCircle size={16} /> Add</>}
                </button>
              </div>
              <p className="text-xs text-gray-400">Each credit allows one event (if bypass is disabled, credits are used). Credits are optional when bypass is enabled.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}