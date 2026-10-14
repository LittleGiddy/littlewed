'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  CheckCheck,
  Clock,
  Hash,
  Loader2,
  MessageCircle,
  Phone,
  Undo2,
  User,
  Users,
  X,
} from 'lucide-react';
import { AppButton, AppChip, type AppChipTone } from '@/components/ui';
import { guestTypeBadge } from '@/lib/guestTypes';
import { formatPhone } from '@/lib/phone';
import { canMarkAsDouble, canMarkAllAsGroup } from '@/lib/checkin';

/**
 * The guest shape the result card needs. It is the intersection of what the
 * camera check-in station and the manual card-number page return from
 * `/api/check-in`, with the contact/route fields optional because the manual
 * page does not surface them.
 */
export interface ScanResultCardGuest {
  id: string;
  name: string;
  title?: string | null;
  cardNumber?: string | null;
  guestType: string | null;
  guestCount?: number | null;
  checkInCount: number;
  maxCheckIns: number;
  fullyCheckedIn: boolean;
  sharedGroup?: boolean;
  groupMembers?: { id: string; name: string; checkedIn: boolean }[];
  cardGroupId?: string | null;
  /** True for the single event-level external QR (no Guest row; unlimited scans). */
  external?: boolean;
  phone?: string | null;
  routingChannel?: string | null;
  checkedInAt?: string | null;
}

interface ScanResultCardProps {
  guest: ScanResultCardGuest;
  reducedMotion?: boolean;
  doubleBusy?: boolean;
  undoBusy?: boolean;
  onClose: () => void;
  onMarkDouble?: () => void;
  onMarkGroup?: () => void;
  onUndo?: (() => void) | null;
}

const fullName = (guest: ScanResultCardGuest) => {
  const name = guest?.name || '';
  const title = guest?.title || '';
  if (!name && !title) return 'Unknown Guest';
  return title ? `${title} ${name}`.trim() : name.trim();
};

function guestTypeTone(guest: ScanResultCardGuest): AppChipTone {
  const type = guest.guestType?.toUpperCase();
  if (type === 'DOUBLE') return 'brand';
  if (type === 'FAMILIA') return 'success';
  if (type === 'WAKWE') return 'warn';
  return 'neutral';
}

/**
 * The card shown after a successful check-in. It replaces the old toast/inline
 * panel with everything the door operator needs in one place: who checked in,
 * which card, whether it is a shared/group card, how to reach them, and the
 * one-tap actions ("Mark as Double" / "Mark all as group" / "Undo").
 *
 * It auto-closes so the queue keeps moving, but the countdown pauses whenever
 * the operator is interacting with it (hover, focus, or a network action in
 * flight) so a decision is never yanked away mid-press.
 */
export default function ScanResultCard({
  guest,
  reducedMotion = false,
  doubleBusy = false,
  undoBusy = false,
  onClose,
  onMarkDouble,
  onMarkGroup,
  onUndo = null,
}: ScanResultCardProps) {
  const isExternal = Boolean(guest.external);
  const offerDouble = Boolean(onMarkDouble) && !isExternal && canMarkAsDouble(guest);
  const offerGroup = Boolean(onMarkGroup) && !isExternal && canMarkAllAsGroup(guest);
  const needsDecision = offerDouble || offerGroup;
  const total = needsDecision ? 9000 : 5000;

  const [remaining, setRemaining] = useState(total);
  const [paused, setPaused] = useState(false);
  const busy = doubleBusy || undoBusy;

  useEffect(() => {
    if (paused || busy) return;
    const id = window.setInterval(() => setRemaining((r) => (r <= 100 ? 0 : r - 100)), 100);
    return () => window.clearInterval(id);
  }, [paused, busy]);

  useEffect(() => {
    if (remaining <= 0) onClose();
  }, [remaining, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const checkedInAt = guest.checkedInAt ? new Date(guest.checkedInAt) : null;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Check-in result"
        initial={reducedMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: 24 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        className="relative w-full max-w-md overflow-hidden rounded-t-card bg-surface shadow-elev-2 sm:rounded-card"
      >
        {/* Countdown drain. Pauses with the auto-close timer. */}
        <div className="h-1 w-full bg-success/15" aria-hidden="true">
          <div
            className="h-full bg-success transition-[width] duration-100 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/12">
            <CheckCircle size={22} className="text-success" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-success">
              Checked in
            </p>
            <p className="truncate font-display text-lg font-black leading-tight text-gray-900">
              {fullName(guest)}
            </p>
          </div>
          {guest.cardNumber ? (
            <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-gray-500">
              <Hash size={12} aria-hidden="true" />
              {guest.cardNumber}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <AppChip tone={guestTypeTone(guest)}>
              {guestTypeBadge(guest.guestType, guest.guestCount)}
            </AppChip>
            {guest.maxCheckIns > 1 ? (
              <AppChip tone="success" solid className="bg-success text-white">
                {guest.checkInCount}/{guest.maxCheckIns} scans
              </AppChip>
            ) : null}
            {isExternal ? <AppChip tone="warn">Event QR</AppChip> : null}
          </div>

          {checkedInAt || guest.phone || guest.routingChannel ? (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {checkedInAt ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <Clock size={14} className="shrink-0 text-gray-400" aria-hidden="true" />
                  <dt className="sr-only">Time</dt>
                  <dd className="tabular-nums text-gray-700">
                    {checkedInAt.toLocaleTimeString('en-TZ', { hour: '2-digit', minute: '2-digit' })}
                  </dd>
                </div>
              ) : null}
              {guest.phone ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <Phone size={14} className="shrink-0 text-gray-400" aria-hidden="true" />
                  <dt className="sr-only">Phone</dt>
                  <dd className="text-gray-700">{formatPhone(guest.phone)}</dd>
                </div>
              ) : null}
              {guest.routingChannel ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <MessageCircle size={14} className="shrink-0 text-gray-400" aria-hidden="true" />
                  <dt className="sr-only">Channel</dt>
                  <dd className="capitalize text-gray-700">{guest.routingChannel}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {/* Shared DOUBLE / group cards: show who is in and who is outstanding. */}
          {guest.groupMembers?.length ? (
            <div className="border-t border-gray-100 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                On this card
              </p>
              <ul className="space-y-1.5">
                {guest.groupMembers.map((member) => (
                  <li key={member.id} className="flex items-center gap-2 text-[13px]">
                    {member.checkedIn ? (
                      <CheckCheck size={14} className="shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <User size={14} className="shrink-0 text-gray-300" aria-hidden="true" />
                    )}
                    <span
                      className={
                        member.checkedIn
                          ? 'break-words text-gray-400 line-through'
                          : 'break-words font-medium text-gray-900'
                      }
                    >
                      {member.name || 'Guest'}
                    </span>
                    <span className="sr-only">{member.checkedIn ? 'checked in' : 'not yet'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-gray-100 px-4 py-3.5">
          {offerDouble ? (
            <AppButton
              size="lg"
              fullWidth
              loading={doubleBusy}
              loadingText="Marking…"
              icon={<Users size={17} />}
              onClick={onMarkDouble}
            >
              Mark as Double
            </AppButton>
          ) : null}
          {offerGroup ? (
            <AppButton
              size="lg"
              fullWidth
              loading={doubleBusy}
              loadingText="Marking…"
              icon={<Users size={17} />}
              onClick={onMarkGroup}
            >
              Mark all as group
            </AppButton>
          ) : null}
          {onUndo && !isExternal ? (
            <button
              type="button"
              disabled={undoBusy}
              onClick={onUndo}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-tap py-2 text-[12px] font-semibold text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50"
            >
              {undoBusy ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <Undo2 size={13} aria-hidden="true" />
              )}
              Undo this scan
            </button>
          ) : null}
          <AppButton variant={needsDecision ? 'ghost' : 'primary'} size="lg" fullWidth onClick={onClose}>
            Done
          </AppButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
