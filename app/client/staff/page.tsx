'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  CircleSlash,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';

import {
  AppAvatar,
  AppBottomSheet,
  AppButton,
  AppCard,
  AppChip,
  AppEmptyState,
  AppField,
  AppInput,
  AppPageHeader,
  AppSegmentedControl,
  AppSkeletonCard,
  AppSkeletonList,
} from '@/components/ui';
import { confirmToast } from '@/lib/confirmToast';

type StaffMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
  isActive: boolean;
  createdAt: string;
  hasSignedIn: boolean;
};

type StaffStats = {
  totalStaff: number;
  activeStaff: number;
  newThisMonth: number;
  eventCount: number;
};

type Filter = 'all' | 'active' | 'pending';

const EMPTY_STATS: StaffStats = { totalStaff: 0, activeStaff: 0, newThisMonth: 0, eventCount: 0 };

/** "3 days ago" / "Today" - the column that actually matters on a team page. */
function relativeJoined(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [stats, setStats] = useState<StaffStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // The sheet is one surface, reused for both "add" and "edit". Tracking a
  // single open record keeps it impossible to open two at once.
  const [sheet, setSheet] = useState<{ mode: 'add' } | { mode: 'edit'; member: StaffMember } | null>(
    null
  );
  const [selected, setSelected] = useState<StaffMember | null>(null);

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/staff', { credentials: 'include' });
      if (!res.ok) {
        setLoadError(res.status === 401 ? 'Your session expired. Please sign in again.' : 'Could not load your team.');
        return;
      }
      const data = await res.json();
      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setStats({ ...EMPTY_STATS, ...(data.stats ?? {}) });
    } catch {
      setLoadError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const openAdd = () => {
    setForm({ name: '', email: '', phone: '', password: '' });
    setFormError('');
    setShowPassword(false);
    setSheet({ mode: 'add' });
  };

  const openEdit = (member: StaffMember) => {
    setForm({ name: member.name, email: member.email, phone: member.phone ?? '', password: '' });
    setFormError('');
    setShowPassword(false);
    setSheet({ mode: 'edit', member });
  };

  const closeSheet = () => {
    if (submitting) return;
    setSheet(null);
    setSelected(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (form.password && form.password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (sheet?.mode === 'add' && form.password.length < 8) {
      setFormError('Choose a password with at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (sheet?.mode === 'add') {
        const res = await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            password: form.password,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError(data.error || 'Could not add this staff member.');
          return;
        }
        toast.success(`${form.name} can now sign in`);
      } else if (sheet?.mode === 'edit') {
        const payload: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          phone: form.phone || null,
        };
        // Empty password means "leave the current one alone".
        if (form.password) payload.password = form.password;

        const res = await fetch(`/api/staff/${sheet.member.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError(data.error || 'Could not save changes.');
          return;
        }
        toast.success('Details updated');
      }

      setSheet(null);
      setSelected(null);
      await loadStaff();
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const setActive = async (member: StaffMember, isActive: boolean) => {
    setRowBusy(member.id);
    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not update access.');
        return;
      }
      // Patch in place so the sheet does not flicker closed on reload.
      setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, isActive } : s)));
      setSelected((cur) => (cur && cur.id === member.id ? { ...cur, isActive } : cur));
      setStats((cur) => ({
        ...cur,
        activeStaff: cur.activeStaff + (isActive ? 1 : -1),
      }));
      toast.success(
        isActive ? `${member.name} can sign in again` : `${member.name} signed out everywhere`
      );
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRowBusy(null);
    }
  };

  const deleteStaff = async (member: StaffMember) => {
    const ok = await confirmToast({
      title: `Delete ${member.name}?`,
      message: 'They lose access immediately. Their check-in history stays on each event.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;

    setRowBusy(member.id);
    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Could not delete this staff member.');
        return;
      }
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
      setStats((cur) => ({
        ...cur,
        totalStaff: Math.max(0, cur.totalStaff - 1),
        activeStaff: member.isActive ? Math.max(0, cur.activeStaff - 1) : cur.activeStaff,
      }));
      setSelected(null);
      setSheet(null);
      toast.success(`${member.name} removed`);
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRowBusy(null);
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy. Select the text and copy manually.');
    }
  };

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (filter === 'active' && !s.isActive) return false;
      if (filter === 'pending' && s.hasSignedIn) return false;
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        (s.phone ?? '').toLowerCase().includes(term)
      );
    });
  }, [staff, search, filter]);

  const pendingCount = staff.filter((s) => !s.hasSignedIn).length;
  const isEditing = sheet?.mode === 'edit';

  return (
    <div className="max-w-5xl mx-auto pb-24">
      <Link
        href="/client/dashboard"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 hover:text-brand transition mb-4"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to Dashboard
      </Link>

      <AppPageHeader
        eyebrow="Management"
        title={
          <>
            Staff <span className="text-coral">Team</span>
          </>
        }
        description="People who can scan guests at the door. Each account works on one device at a time."
        actions={
          <AppButton icon={<UserPlus size={16} />} onClick={openAdd} className="w-full sm:w-auto">
            Add Staff
          </AppButton>
        }
      />

      {loadError ? (
        <div className="mt-6 bg-danger-soft border border-danger-border text-danger p-3.5 rounded-tap flex items-center justify-between gap-3 text-[13px] font-medium">
          <span>{loadError}</span>
          <AppButton size="sm" variant="outline" onClick={() => void loadStaff()}>
            Retry
          </AppButton>
        </div>
      ) : null}

      {/* ── Widgets ────────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Team size"
          value={stats.totalStaff}
          icon={<Users size={15} />}
          tone="brand"
          loading={loading}
        />
        <StatTile
          label="Can sign in"
          value={stats.activeStaff}
          icon={<ShieldCheck size={15} />}
          tone="success"
          hint={stats.totalStaff > 0 ? `${stats.totalStaff - stats.activeStaff} paused` : undefined}
          loading={loading}
        />
        <StatTile
          label="Not signed in yet"
          value={pendingCount}
          icon={<Clock size={15} />}
          tone={pendingCount > 0 ? 'warn' : 'neutral'}
          loading={loading}
        />
        <StatTile
          label="Your events"
          value={stats.eventCount}
          icon={<CalendarCheck size={15} />}
          tone="neutral"
          loading={loading}
        />
      </div>

      {/* ── Search + filter ────────────────────────────────────────── */}
      {staff.length > 0 ? (
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or phone"
              aria-label="Search staff"
              className="w-full h-11 pl-10 pr-3.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-tap placeholder:text-gray-300 transition-all duration-150 ease-soft focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </div>
          <AppSegmentedControl
            label="Filter staff"
            value={filter}
            onChange={setFilter}
            className="sm:w-auto sm:shrink-0"
            options={[
              { value: 'all', label: 'All', badge: staff.length },
              { value: 'active', label: 'Active', badge: stats.activeStaff },
              { value: 'pending', label: 'Not signed in', badge: pendingCount },
            ]}
          />
        </div>
      ) : null}

      {/* ── Team list ──────────────────────────────────────────────── */}
      <div className="mt-4">
        {loading ? (
          <div className="space-y-3">
            <AppSkeletonCard />
            <AppSkeletonList count={3} />
          </div>
        ) : staff.length === 0 ? (
          <AppCard padded={false}>
            <AppEmptyState
              icon={<Users size={22} />}
              title="No staff members yet"
              description="Add someone who can work the door - they will be able to scan guests and check people in."
              action={<AppButton icon={<UserPlus size={16} />} onClick={openAdd}>Add Staff</AppButton>}
            />
          </AppCard>
        ) : visible.length === 0 ? (
          <AppCard padded={false}>
            <AppEmptyState
              size="sm"
              icon={<Search size={20} />}
              title="No one matches"
              description={
                search
                  ? `Nothing found for "${search}". Try a different name or email.`
                  : 'No staff members in this view.'
              }
              action={
                <AppButton
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setFilter('all');
                  }}
                >
                  Clear filters
                </AppButton>
              }
            />
          </AppCard>
        ) : (
          <ul className="grid gap-2.5 sm:gap-3">
            {visible.map((member) => (
              <li key={member.id}>
                <StaffRow
                  member={member}
                  busy={rowBusy === member.id}
                  onOpen={() => setSelected(member)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {staff.length > 0 ? (
        <p className="mt-4 text-[12px] text-gray-400 leading-relaxed">
          Tap any team member to see their details, change their password, or pause their access.
        </p>
      ) : null}

      {/* ── Detail sheet ───────────────────────────────────────────── */}
      <AppBottomSheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name}
        description={selected?.email}
      >
        {selected ? (
          <StaffDetail
            member={selected}
            busy={rowBusy === selected.id}
            onEdit={() => openEdit(selected)}
            onCopy={copy}
            onToggleActive={() => void setActive(selected, !selected.isActive)}
            onDelete={() => void deleteStaff(selected)}
          />
        ) : null}
      </AppBottomSheet>

      {/* ── Add / edit sheet ───────────────────────────────────────── */}
      <AppBottomSheet
        open={Boolean(sheet)}
        onClose={closeSheet}
        title={isEditing ? 'Edit staff member' : 'Add staff member'}
        description={
          isEditing
            ? 'Changing the password signs them out of their current device.'
            : 'They will sign in with the email and password you set here.'
        }
        footer={
          <div className="flex gap-2.5">
            <AppButton
              variant="outline"
              className="flex-1"
              onClick={closeSheet}
              disabled={submitting}
            >
              Cancel
            </AppButton>
            <AppButton
              className="flex-1"
              type="submit"
              form="staff-form"
              loading={submitting}
              loadingText="Saving…"
            >
              {isEditing ? 'Save changes' : 'Create account'}
            </AppButton>
          </div>
        }
      >
        <form id="staff-form" onSubmit={submit} className="space-y-4 pb-1">
          {formError ? (
            <p
              role="alert"
              className="text-[13px] font-medium text-danger bg-danger-soft border border-danger-border rounded-tap px-3.5 py-2.5"
            >
              {formError}
            </p>
          ) : null}

          <AppInput
            label="Full name"
            required
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Neema Peter"
            data-autofocus
          />

          <AppInput
            label="Email address"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="name@venue.com"
            hint="This is their sign-in name."
          />

          <AppInput
            label="Phone (optional)"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+255 700 000 000"
          />

          <AppField
            label={isEditing ? 'New password' : 'Password'}
            required={!isEditing}
            hint={
              isEditing
                ? 'Leave blank to keep the current password.'
                : 'At least 8 characters. Share it with them directly.'
            }
          >
            {(fieldProps) => (
              <div className="relative">
                <input
                  {...fieldProps}
                  type={showPassword ? 'text' : 'password'}
                  required={!isEditing}
                  minLength={8}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={isEditing ? 'Unchanged' : 'At least 8 characters'}
                  className={`w-full px-3.5 py-2.5 pr-11 text-sm text-gray-900 bg-white border border-gray-200 rounded-tap placeholder:text-gray-300 transition-all duration-150 ease-soft focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 ${
                    formError ? 'border-danger' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-tap text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            )}
          </AppField>
        </form>
      </AppBottomSheet>
    </div>
  );
}

/* ── Widget tile ─────────────────────────────────────────────────────── */

const TILE_TONES = {
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  neutral: 'bg-gray-100 text-gray-500',
} as const;

function StatTile({
  label,
  value,
  icon,
  tone,
  hint,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: keyof typeof TILE_TONES;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <AppCard padded={false} className="p-3.5 sm:p-4">
      <div className="flex items-center gap-2">
        <span
          className={`w-7 h-7 rounded-tap grid place-items-center shrink-0 ${TILE_TONES[tone]}`}
          aria-hidden="true"
        >
          {icon}
        </span>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider leading-tight min-w-0 truncate">
          {label}
        </p>
      </div>
      {loading ? (
        <div className="mt-2.5 h-8 w-12 rounded-tap bg-gray-100 animate-pulse" />
      ) : (
        <p className="mt-2 font-display text-3xl font-black text-gray-900 leading-none tabular-nums">
          {value}
        </p>
      )}
      {hint && !loading ? <p className="mt-1.5 text-[11px] text-gray-400">{hint}</p> : null}
    </AppCard>
  );
}

/* ── List row ────────────────────────────────────────────────────────── */

function StaffRow({
  member,
  busy,
  onOpen,
}: {
  member: StaffMember;
  busy: boolean;
  onOpen: () => void;
}) {
  // A native <button> rather than AppCard as="button", so the whole row is a
  // single keyboard-reachable target with correct button semantics.
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-full text-left bg-white border border-gray-200/80 shadow-elev-1 rounded-card p-3.5 sm:p-4 cursor-pointer transition-all duration-150 ease-soft active:scale-[0.985] hover:border-brand/30 hover:shadow-elev-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      aria-label={`${member.name}, ${member.isActive ? 'active' : 'paused'}. Open options.`}
    >
      <div className="flex items-center gap-3 sm:gap-3.5">
        <div className="relative shrink-0">
          <AppAvatar name={member.name} imageUrl={member.image} size="md" />
          {!member.isActive ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gray-400 ring-2 ring-white grid place-items-center"
              title="Access paused"
            >
              <CircleSlash size={9} className="text-white" aria-hidden="true" />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate min-w-0">{member.name}</p>
            {!member.isActive ? <AppChip tone="neutral">Paused</AppChip> : null}
            {member.isActive && !member.hasSignedIn ? (
              <AppChip tone="warn">Not signed in</AppChip>
            ) : null}
          </div>
          <p className="text-[13px] text-gray-400 truncate mt-0.5">{member.email}</p>
          <p className="text-[11px] text-gray-300 mt-1 sm:hidden">
            {member.isActive ? 'Active' : 'Paused'} · joined {relativeJoined(member.createdAt)}
          </p>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
          <AppChip tone={member.isActive ? 'success' : 'neutral'}>
            {member.isActive ? 'Active' : 'Paused'}
          </AppChip>
          <span className="text-[11px] text-gray-300 whitespace-nowrap">
            {relativeJoined(member.createdAt)}
          </span>
        </div>

        {!busy ? (
          <MoreHorizontal
            size={18}
            aria-hidden="true"
            className="shrink-0 text-gray-300"
          />
        ) : null}
        {busy ? (
          <span
            className="absolute right-3.5 bottom-3.5 w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
        ) : null}
      </div>
    </button>
  );
}

/* ── Detail sheet body ───────────────────────────────────────────────── */

/**
 * Lets the tenant pick exactly which events a staff member may access. Baked
 * straight into the staff detail sheet so the grant (and its revocation) lives
 * next to the person's account — no separate screen to forget about.
 */
function EventAccessManager({ memberId, disabled }: { memberId: string; disabled: boolean }) {
  const [events, setEvents] = useState<
    { id: string; name: string; date: string; granted: boolean }[] | null
  >(null);
  const [toggled, setToggled] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/staff/${memberId}/events`, { credentials: 'include' });
      if (!res.ok) {
        setError('Could not load events');
        setEvents([]);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data.events) ? data.events : [];
      const granted = list.filter((e: any) => e.granted).map((e: any) => e.id);
      setEvents(list);
      setToggled(granted);
      setSaved(granted);
    } catch {
      setError('Network error');
      setEvents([]);
    }
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setToggled((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const isDirty = toggled.length !== saved.length || toggled.some((id) => !saved.includes(id));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/staff/${memberId}/events`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventIds: toggled }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaved(toggled);
        toast.success('Event access updated');
      } else {
        toast.error(data.error || 'Save failed');
        void load();
      }
    } catch {
      toast.error('Network error');
    }
    setSaving(false);
  };

  if (events === null) {
    return (
      <div className="rounded-tap border border-gray-100 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
          <ShieldCheck size={14} className="text-brand" /> What they can access
        </p>
        <p className="text-xs text-gray-400 animate-pulse">
          {error || 'Loading events…'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-tap border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100">
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 uppercase tracking-wider">
          <ShieldCheck size={14} className="text-brand" /> What they can access
        </p>
        <span className="text-[11px] font-semibold text-brand">
          {toggled.length} of {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="px-3.5 py-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            Event access is granted per event. Create an event first, then come back — this staff
            member can sign in, but won't see any event until you grant one.
          </p>
        </div>
      ) : (
        <>
          <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
            {events.map((e) => {
              const checked = toggled.includes(e.id);
              return (
                <label
                  key={e.id}
                  className="flex items-start gap-2.5 px-3.5 py-2.5 cursor-pointer hover:bg-gray-50 transition"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(e.id)}
                    disabled={disabled || saving}
                    className="mt-0.5 accent-brand"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-gray-800 truncate">{e.name}</span>
                    <span className="block text-[11px] text-gray-400">
                      {new Date(e.date).toLocaleDateString('en-TZ', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="px-3.5 py-3 border-t border-gray-100">
            <AppButton
              size="sm"
              fullWidth
              disabled={!isDirty || saving || disabled}
              loading={saving}
              loadingText="Saving…"
              onClick={save}
            >
              {isDirty ? 'Save access' : 'All saved'}
            </AppButton>
          </div>
        </>
      )}
    </div>
  );
}

function StaffDetail({
  member,
  busy,
  onEdit,
  onCopy,
  onToggleActive,
  onDelete,
}: {
  member: StaffMember;
  busy: boolean;
  onEdit: () => void;
  onCopy: (value: string, label: string) => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-5 pb-1">
      <div className="flex items-center gap-3.5">
        <AppAvatar name={member.name} imageUrl={member.image} size="lg" />
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-gray-900 leading-tight truncate">
            {member.name}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <AppChip tone={member.isActive ? 'success' : 'neutral'}>
              {member.isActive ? 'Active' : 'Paused'}
            </AppChip>
            {member.isActive && !member.hasSignedIn ? (
              <AppChip tone="warn">Never signed in</AppChip>
            ) : (
              <AppChip tone="brand">Signed in</AppChip>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-tap border border-gray-100 divide-y divide-gray-100">
        <DetailRow
          icon={<Mail size={14} />}
          label="Email"
          value={member.email}
          onCopy={() => onCopy(member.email, 'Email')}
        />
        {member.phone ? (
          <DetailRow
            icon={<Phone size={14} />}
            label="Phone"
            value={member.phone}
            onCopy={() => onCopy(member.phone as string, 'Phone')}
          />
        ) : null}
        <DetailRow
          icon={<CalendarCheck size={14} />}
          label="Joined"
          value={new Date(member.createdAt).toLocaleDateString('en-TZ', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        />
      </div>

      <AppButton variant="outline" fullWidth icon={<Pencil size={15} />} onClick={onEdit}>
        Edit details or reset password
      </AppButton>

      <EventAccessManager memberId={member.id} disabled={busy} />

      <div className="space-y-2">
        <ActionRow
          icon={member.isActive ? <UserX size={16} /> : <Check size={16} />}
          title={member.isActive ? 'Pause their access' : 'Let them sign in again'}
          description={
            member.isActive
              ? 'Signs them out of their device. Their past check-ins are kept.'
              : 'Restores their ability to sign in on one device.'
          }
          tone={member.isActive ? 'warn' : 'success'}
          disabled={busy}
          onClick={onToggleActive}
        />
        <ActionRow
          icon={<Trash2 size={16} />}
          title="Delete staff member"
          description="Removes the account for good."
          tone="danger"
          disabled={busy}
          onClick={onDelete}
        />
      </div>

      <p className="text-[11px] text-gray-300 leading-relaxed">
        Staff accounts work on a single device. If they sign in on a new phone or tablet, the old
        one is signed out automatically.
      </p>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span className="text-gray-300 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-[13px] text-gray-800 truncate mt-0.5">{value}</p>
      </div>
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="w-8 h-8 shrink-0 grid place-items-center rounded-tap text-gray-400 hover:text-brand hover:bg-brand-soft transition"
        >
          <Copy size={14} />
        </button>
      ) : null}
    </div>
  );
}

const ACTION_TONES = {
  warn: 'text-warn',
  success: 'text-success',
  danger: 'text-danger',
} as const;

function ActionRow({
  icon,
  title,
  description,
  tone,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: keyof typeof ACTION_TONES;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-start gap-3 text-left p-3.5 rounded-tap border border-gray-100 hover:bg-gray-50 active:bg-gray-100/70 transition disabled:opacity-50"
    >
      <span className={`shrink-0 mt-0.5 ${ACTION_TONES[tone]}`} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-gray-800">{title}</span>
        <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug">{description}</span>
      </span>
    </button>
  );
}
