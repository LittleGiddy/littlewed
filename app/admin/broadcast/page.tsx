'use client';

import { useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Megaphone, Send, Loader2, FileUp, X, Users, Mail } from 'lucide-react';

const AUDIENCES = [
  { value: 'all', label: 'All users', desc: 'Every active wedding owner and staff account' },
  { value: 'clients', label: 'Wedding owners', desc: 'Only CLIENT (owner) accounts' },
  { value: 'staff', label: 'Staff', desc: 'Only STAFF accounts' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BroadcastPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [mode, setMode] = useState<'users' | 'external'>('users');
  const [externalText, setExternalText] = useState('');
  const [fileName, setFileName] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ userCount: number; externalCount?: number; emailed: number; failedEmails: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (sessionStatus === 'loading') return null;
  if (!session || (session.user as any)?.role !== 'SUPER_ADMIN') {
    router.push('/login');
    return null;
  }

  const parseExternalEmails = (raw: string): { valid: string[]; invalid: number } => {
    const tokens = raw
      .split(/[,\n;\t]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);
    const valid = Array.from(new Set(tokens.filter(t => EMAIL_RE.test(t))));
    const invalid = tokens.length - valid.length;
    return { valid, invalid };
  };

  const validatedEmails = parseExternalEmails(externalText);

  const handleFileUpload = (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.txt')) {
      toast.error('Please upload a .csv or .txt file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (!text.trim()) {
        toast.error('File is empty');
        return;
      }
      setFileName(file.name);
      setExternalText(prev => (prev.trim() ? prev.trim() + '\n' : '') + text.trim());
      toast.success('Emails loaded from file');
    };
    reader.readAsText(file);
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    if (mode === 'external' && validatedEmails.valid.length === 0) {
      toast.error('Paste or import at least one valid email address');
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          mode === 'external'
            ? { subject, message, externalEmails: validatedEmails.valid }
            : { subject, message, audience }
        ),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({
          userCount: data.userCount || 0,
          externalCount: data.externalCount,
          emailed: data.emailed || 0,
          failedEmails: data.failedEmails || 0,
        });
        toast.success(
          mode === 'external'
            ? `Broadcast sent to ${data.externalCount || 0} email${(data.externalCount || 0) === 1 ? '' : 's'}`
            : `Broadcast sent to ${data.userCount || 0} user${(data.userCount || 0) === 1 ? '' : 's'}`
        );
        setSubject('');
        setMessage('');
        if (mode === 'external') setExternalText('');
      } else {
        toast.error(data.error || 'Failed to send broadcast');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B]">
            <Megaphone size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Send Broadcast</h2>
            <p className="text-sm text-gray-400">Notify owners and staff by email, in-app, and push notification.</p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipients</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
              <button
                type="button"
                onClick={() => setMode('users')}
                className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                  mode === 'users' ? 'border-[#0D4B4B] bg-[#0D4B4B]/5' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-semibold flex items-center gap-1.5 ${mode === 'users' ? 'text-[#0D4B4B]' : 'text-gray-800'}`}>
                  <Users size={15} /> Platform accounts
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Owners and staff (email, in-app, push)</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('external')}
                className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                  mode === 'external' ? 'border-[#0D4B4B] bg-[#0D4B4B]/5' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-semibold flex items-center gap-1.5 ${mode === 'external' ? 'text-[#0D4B4B]' : 'text-gray-800'}`}>
                  <Mail size={15} /> External email list
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Paste or import emails (bulk marketing, email only)</p>
              </button>
            </div>
          </div>

          {mode === 'users' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Audience</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAudience(a.value)}
                    className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                      audience === a.value
                        ? 'border-[#0D4B4B] bg-[#0D4B4B]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${audience === a.value ? 'text-[#0D4B4B]' : 'text-gray-800'}`}>{a.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'external' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">External email list</label>
              <textarea
                value={externalText}
                onChange={(e) => { setExternalText(e.target.value); if (fileName) setFileName(''); }}
                rows={6}
                placeholder={'Paste one email per line (or comma-separated)...\ne.g. guest1@example.com, guest2@example.com'}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0D4B4B]/30 focus:border-[#0D4B4B] resize-none"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = '';
                }}
              />
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <FileUp size={14} /> Import .csv / .txt
                </button>
                {fileName && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <span className="font-medium text-[#0D4B4B]">{fileName}</span>
                    <button onClick={() => { setFileName(''); }} className="p-0.5 rounded hover:bg-gray-100 text-gray-400" title="Clear file name">
                      <X size={12} />
                    </button>
                  </span>
                )}
                {externalText.trim() && (
                  <span className={`text-xs ${validatedEmails.invalid > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {validatedEmails.valid.length} valid email{validatedEmails.valid.length === 1 ? '' : 's'}
                    {validatedEmails.invalid > 0 ? `, ${validatedEmails.invalid} ignored` : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Scheduled maintenance this weekend"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0D4B4B]/30 focus:border-[#0D4B4B]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Write your announcement here..."
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0D4B4B]/30 focus:border-[#0D4B4B] resize-none"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              {mode === 'external'
                ? 'Emails are sent from admin@littlewed.co.tz. External lists receive email only (no in-app or push).'
                : 'Sent as an email from admin@littlewed.co.tz, plus an in-app notification and push alert.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSend}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0D4B4B] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#0D4B4B]/90 transition-colors disabled:opacity-60"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? 'Sending...' : 'Send Broadcast'}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Broadcast Result</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-2xl font-bold text-gray-900">
                {mode === 'external' ? result.externalCount ?? 0 : result.userCount}
              </p>
              <p className="text-xs text-gray-400">{mode === 'external' ? 'Recipients' : 'Users notified'}</p>
            </div>
            <div className="rounded-xl bg-[#0D4B4B]/5 p-4">
              <p className="text-2xl font-bold text-[#0D4B4B]">{result.emailed}</p>
              <p className="text-xs text-gray-400">Emails sent</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-2xl font-bold text-red-600">{result.failedEmails}</p>
              <p className="text-xs text-gray-400">Email failures</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
