'use client';
import { useEffect, useState } from 'react';
import { UserPlus, Trash2, ArrowLeft, Eye, EyeOff, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadStaff = async () => {
    try {
      const res = await fetch('/api/staff', { credentials: 'include' });
      if (res.ok) {
        setStaff(await res.json());
      }
      setLoading(false);
    } catch {
      setError('Failed to load staff');
      setLoading(false);
    }
  };

  useEffect(() => { loadStaff(); }, []);

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });
      if (res.ok) {
        setShowForm(false);
        setEmail('');
        setPassword('');
        setName('');
        loadStaff();
        toast.success('Staff member added');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add staff');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setSubmitting(false);
  };

  const deleteStaff = async (id: string) => {
    const ok = await confirmToast({ title: 'Delete this staff member?', message: 'This action cannot be undone.', confirmText: 'Delete', danger: true });
    if (ok) {
      try {
        const res = await fetch(`/api/staff/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) {
          loadStaff();
          toast.success('Staff member deleted');
        } else {
          const data = await res.json();
          setError(data.error || 'Failed to delete');
        }
      } catch {
        setError('Network error');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/client/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4B4B] bg-[#0D4B4B]/5 border border-[#0D4B4B]/10 rounded-xl px-3.5 py-1.5 transition hover:bg-[#0D4B4B]/10 mb-6"
      >
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="text-[11px] font-bold tracking-[1.5px] uppercase text-[#0D4B4B] mb-1">Management</div>
          <h1 className="font-serif text-3xl md:text-4xl font-black text-gray-900 leading-tight tracking-tight">
            Staff <span className="text-[#FF6B5C]">Members</span>
          </h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-[#0D4B4B] to-[#0A3939] text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md shadow-[#0D4B4B]/25 hover:shadow-lg hover:shadow-[#0D4B4B]/30 transition-all flex items-center gap-2"
        >
          <UserPlus size={16} /> Add Staff
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center justify-between mb-6 text-sm">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Add Staff Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-[modalIn_0.2s_cubic-bezier(0.16,1,0.3,1)_both]"
            onClick={e => e.stopPropagation()}
          >
            <style>{`
              @keyframes modalIn {
                from { opacity: 0; transform: scale(0.95) translateY(8px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
            `}</style>
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="font-serif text-xl font-extrabold text-gray-800">Add Staff Member</h2>
            </div>
            <form onSubmit={addStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-[#0D4B4B] to-[#0A3939] text-white py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-[#0D4B4B]/25 hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submitting ? 'Creating...' : 'Create Staff'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50 transition bg-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff List Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h2 className="font-serif text-lg font-extrabold text-gray-800">Team Members</h2>
          <span className="text-[11px] font-bold text-[#0D4B4B] bg-[#0D4B4B]/5 border border-[#0D4B4B]/10 px-2.5 py-1 rounded-full">
            {staff.length} staff
          </span>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4B4B] rounded-full animate-spin" />
          </div>
        ) : staff.length === 0 ? (
          <div className="py-12 text-center">
            <div className="flex justify-center text-gray-400 mb-3"><Users size={40} /></div>
            <h3 className="font-serif text-lg font-bold text-gray-800 mb-1">No staff members yet</h3>
            <p className="text-sm text-gray-400">Add your first team member to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 font-semibold text-gray-800">{s.name}</td>
                    <td className="px-5 py-3 text-gray-600">{s.email}</td>
                    <td className="px-5 py-3 text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => deleteStaff(s.id)}
                        className="text-red-400 hover:text-red-600 transition bg-transparent border-none cursor-pointer p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
