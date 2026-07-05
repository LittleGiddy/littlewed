'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, Lock, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  // ─── Profile form ──────────────────────────────────────────────
  const [name, setName] = useState(session?.user?.name || '');
  const [email, setEmail] = useState(session?.user?.email || '');
  const [phone, setPhone] = useState((session?.user as any)?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // ─── Password form ────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // ─── Handle profile update ────────────────────────────────────
const handleProfileUpdate = async (e: React.FormEvent) => {
  e.preventDefault();
  setSavingProfile(true);
  try {
    const res = await fetch('/api/client/profile', {   // ✅ corrected endpoint
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone }),
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      // ✅ Update local state with the fresh data from the server
      setName(data.name);
      setEmail(data.email);
      setPhone(data.phone || '');
      toast.success('Profile updated successfully');
      await update(); // Refresh the session (optional but good)
    } else {
      toast.error(data.error || 'Update failed');
    }
  } catch {
    toast.error('Network error');
  } finally {
    setSavingProfile(false);
  }
};

  // ─── Handle password change ────────────────────────────────────
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingPassword(false);
    }
  };

  if (!session) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="font-serif text-3xl font-black text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-500 mb-8">Manage your account details and password.</p>

      <div className="space-y-8">
        {/* ─── Profile Card ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-serif text-lg font-bold text-gray-800">Profile Information</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleProfileUpdate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                    placeholder="e.g., +255712345678"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Optional, for admin use.</p>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white py-2.5 rounded-xl font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingProfile ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
                ) : (
                  <><Save size={18} /> Save Profile</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ─── Password Card ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-serif text-lg font-bold text-gray-800">Change Password</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                    required
                    minLength={8}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Minimum 8 characters.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showPasswords"
                  checked={showPassword}
                  onChange={() => setShowPassword(!showPassword)}
                  className="w-4 h-4 rounded border-gray-300 text-[#0D4F4F] focus:ring-[#0D4F4F]"
                />
                <label htmlFor="showPasswords" className="text-sm text-gray-600 cursor-pointer">
                  Show passwords
                </label>
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="w-full bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white py-2.5 rounded-xl font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingPassword ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Updating...</>
                ) : (
                  <><Lock size={18} /> Change Password</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}