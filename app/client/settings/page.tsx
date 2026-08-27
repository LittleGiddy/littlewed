'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  User, Mail, Phone, Lock, Save, Loader2, Eye, EyeOff,
  Camera, Shield, Calendar, Building2, Bell, Trash2,
  AlertTriangle, CheckCircle, CreditCard, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(session?.user?.name || '');
  const [email, setEmail] = useState(session?.user?.email || '');
  const [phone, setPhone] = useState((session?.user as any)?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState((session?.user as any)?.image || '');

  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWhatsApp, setNotifWhatsApp] = useState(true);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const user = session?.user as any;
  const userInitial = (user?.name || 'U').charAt(0).toUpperCase();
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown';

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }

    setUploadingAvatar(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('avatar', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/user/upload-avatar');
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = async () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.avatarUrl) {
          setAvatarUrl(data.avatarUrl);
          setUploadProgress(100);
          await update();
          toast.success('Profile photo updated');
        } else {
          toast.error(data.error || 'Upload failed');
        }
      } catch {
        toast.error('Upload failed');
      } finally {
        setTimeout(() => {
          setUploadingAvatar(false);
          setUploadProgress(0);
        }, 300);
      }
    };

    xhr.onerror = () => {
      toast.error('Upload failed');
      setUploadingAvatar(false);
      setUploadProgress(0);
    };

    xhr.send(formData);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch('/api/client/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setName(data.name);
        setEmail(data.email);
        setPhone(data.phone || '');
        toast.success('Profile updated successfully');
        await update();
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingProfile(false);
    }
  };

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
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4B4B] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* ─── Page Header ─── */}
      <div className="mb-7">
        <p className="text-[11px] font-bold tracking-[1.5px] text-[#0D4B4B] uppercase mb-1.5">Account</p>
        <h1 className="font-serif text-3xl sm:text-[32px] font-black text-gray-900 leading-tight tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-gray-400 mt-1.5">Manage your account, profile, and preferences.</p>
      </div>

      <div className="space-y-5">
        {/* ─── Profile Card ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Avatar Section */}
          <div className="px-6 py-6 border-b border-gray-100">
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0D4B4B] to-pink-400 flex items-center justify-center text-white font-bold text-2xl font-serif shadow-lg shadow-[#0D4B4B]/20 overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    userInitial
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none"
                >
                  {uploadingAvatar ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <Camera size={20} className="text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                {/* Progress Ring */}
                {uploadingAvatar && (
                  <svg
                    className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90 pointer-events-none"
                    viewBox="0 0 88 88"
                  >
                    <circle
                      cx="44"
                      cy="44"
                      r="40"
                      fill="none"
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="44"
                      cy="44"
                      r="40"
                      fill="none"
                      stroke="white"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - uploadProgress / 100)}`}
                      className="transition-[stroke-dashoffset] duration-300 ease-out"
                    />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="font-serif text-lg font-extrabold text-gray-800">{name || 'User'}</h3>
                <p className="text-sm text-gray-400 mt-0.5">{email}</p>
                {uploadingAvatar ? (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-[#0D4B4B] font-semibold m-0">Uploading…</p>
                      <p className="text-xs text-[#0D4B4B] font-bold m-0">{uploadProgress}%</p>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#0D4B4B] to-[#0D4B4B] rounded-full transition-[width] duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 mt-1">Click photo to change</p>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-4">Profile Information</h2>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                    placeholder="e.g., +255712345678"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Optional, for admin and notifications.</p>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full bg-gradient-to-r from-[#0D4B4B] to-[#0A3939] text-white py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-[#0D4B4B]/25 hover:shadow-lg hover:shadow-[#0D4B4B]/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingProfile ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save size={16} /> Save Profile</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ─── Account Details Card ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-4">Account Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B] shrink-0">
                  <Shield size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider m-0">Role</p>
                  <p className="text-sm font-bold text-gray-800 m-0 mt-0.5">
                    {user?.role === 'CLIENT' ? 'Organization Owner' : user?.role || 'User'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Calendar size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider m-0">Member Since</p>
                  <p className="text-sm font-bold text-gray-800 m-0 mt-0.5">{memberSince}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <CheckCircle size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider m-0">Email Verified</p>
                  <p className="text-sm font-bold text-gray-800 m-0 mt-0.5">
                    {user?.emailVerified ? 'Yes' : 'Not yet'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
                  <Building2 size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider m-0">Organization</p>
                  <p className="text-sm font-bold text-gray-800 m-0 mt-0.5 truncate max-w-[140px]">
                    {user?.tenantId ? 'Active' : 'None'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Notification Preferences ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-1">Notifications</h2>
            <p className="text-xs text-gray-400 mb-4">Choose how you want to be notified.</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B] shrink-0">
                    <Mail size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 m-0">Email Notifications</p>
                    <p className="text-xs text-gray-400 m-0 mt-0.5">Receive updates via email</p>
                  </div>
                </div>
                <button
                  onClick={() => setNotifEmail(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer border-none ${
                    notifEmail ? 'bg-[#0D4B4B]' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    notifEmail ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 m-0">WhatsApp Alerts</p>
                    <p className="text-xs text-gray-400 m-0 mt-0.5">Get important alerts on WhatsApp</p>
                  </div>
                </div>
                <button
                  onClick={() => setNotifWhatsApp(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer border-none ${
                    notifWhatsApp ? 'bg-[#0D4B4B]' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    notifWhatsApp ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Change Password Card ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="font-serif text-lg font-extrabold text-gray-800 mb-1">Change Password</h2>
            <p className="text-xs text-gray-400 mb-4">Keep your account secure with a strong password.</p>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                    required
                    minLength={8}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Minimum 8 characters.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="w-full bg-gradient-to-r from-[#0D4B4B] to-[#0A3939] text-white py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-[#0D4B4B]/25 hover:shadow-lg hover:shadow-[#0D4B4B]/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingPassword ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                ) : (
                  <><Lock size={16} /> Change Password</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ─── Danger Zone ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-red-500" />
              <h2 className="font-serif text-lg font-extrabold text-red-600 m-0">Danger Zone</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">Irreversible actions. Proceed with caution.</p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 border border-red-200 rounded-xl bg-red-50 text-red-600 text-sm font-semibold cursor-pointer transition-all hover:bg-red-100 hover:border-red-300"
              >
                <Trash2 size={16} /> Delete Account
              </button>
            ) : (
              <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                <p className="text-sm text-red-700 font-medium mb-3">
                  Are you sure? This will permanently delete your account and all associated data.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      toast.success('Contact support to delete your account');
                      setShowDeleteConfirm(false);
                    }}
                    disabled={deletingAccount}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg border-none cursor-pointer hover:bg-red-700 disabled:opacity-50"
                  >
                    {deletingAccount ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-white text-gray-600 text-sm font-semibold rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
