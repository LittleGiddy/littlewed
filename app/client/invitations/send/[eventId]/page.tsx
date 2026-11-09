'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Phone,
  MessageCircle,
  CheckCircle2,
  Users,
  ChevronRight,
  ShieldCheck,
  ArrowRight,
  Inbox,
  CalendarDays,
  MapPin,
  Send,
  Clock3,
} from 'lucide-react';
import {
  useGuestData,
  FlowSteps,
  FlowHeader,
  LoadingState,
  NeedCardsBanner,
} from '../components/shared';
import { AppButton, AppEmptyState } from '@/components/ui';
import { motionEase, motionDuration, useReducedMotion } from '@/lib/motion';

type Channel = 'sms' | 'whatsapp';

const CHANNEL_META: Record<
  Channel,
  {
    title: string;
    description: string;
    accent: string;
    iconBg: string;
    progress: string;
    chip: string;
  }
> = {
  sms: {
    title: 'Send via SMS',
    description: 'Simple text message with the card number and type — works on every phone.',
    accent: '#0D4B4B',
    iconBg: 'from-brand-600 to-brand-deep',
    progress: 'bg-brand',
    chip: 'bg-brand-soft text-brand',
  },
  whatsapp: {
    title: 'Send via WhatsApp',
    description: 'Approved template with the card image and a confirm button.',
    accent: '#25D366',
    iconBg: 'from-[#31e072] to-[#128C7E]',
    progress: 'bg-[#25D366]',
    chip: 'bg-[#25D366]/10 text-[#128C7E]',
  },
};

export default function SendChannelPickerPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const { event, guests, loading, smsPending, whatsappPending, smsSent, whatsappSent, missingCards, bypassPayment } =
    useGuestData(eventId);
  const reduceMotion = useReducedMotion();

  if (loading) return <LoadingState label="Loading invitations..." />;

  const invited = guests.filter(g => g.smsSentAt || g.whatsappSentAt).length;
  const awaiting = guests.filter(g => g.phone && !g.smsSentAt && !g.whatsappSentAt).length;
  const anyGuests = guests.length > 0;

  const eventDate = event?.date
    ? new Date(event.date).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: reduceMotion ? 0 : 0.07, delayChildren: reduceMotion ? 0 : 0.04 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0 : motionDuration.slow, ease: motionEase },
    },
  };

  const channels: { key: Channel; pending: number; sent: number }[] = [
    { key: 'sms', pending: smsPending.length, sent: smsSent.length },
    { key: 'whatsapp', pending: whatsappPending.length, sent: whatsappSent.length },
  ];

  return (
    <div className="mx-auto max-w-lg px-4 py-5 sm:px-6 sm:py-8">
      <FlowHeader
        backUrl={`/client/events/${eventId}`}
        title="Send Invitations"
        subtitle={event?.name || undefined}
      />
      <FlowSteps current={1} />

      {/* ─── Hero summary ─── */}
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : motionDuration.slow, ease: motionEase }}
        className="relative mb-5 overflow-hidden rounded-[24px] bg-gradient-to-br from-brand-600 via-brand to-brand-deep p-5 text-white shadow-[0_18px_40px_-18px_rgba(13,75,75,0.65)]"
      >
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10 blur-sm" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-white/5" />

        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Invitation status</p>
          <h2 className="mt-1 font-display text-2xl font-black leading-tight">
            {event?.name || 'Your event'}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-medium text-white/75">
            {eventDate && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={12} /> {eventDate}
              </span>
            )}
            {event?.venue && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin size={12} className="shrink-0" /> <span className="truncate">{event.venue}</span>
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'Guests', value: guests.length, icon: Users },
              { label: 'Invited', value: invited, icon: CheckCircle2 },
              { label: 'Awaiting', value: awaiting, icon: Clock3 },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-2xl bg-white/10 px-2.5 py-2.5 backdrop-blur-sm">
                  <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-white/60">
                    <Icon size={11} /> {stat.label}
                  </span>
                  <p className="mt-0.5 text-xl font-black tabular-nums leading-none">{stat.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {missingCards.length > 0 && (
        <div className="mb-4">
          <NeedCardsBanner count={missingCards.length} />
        </div>
      )}

      {!bypassPayment && anyGuests && (
        <div className="mb-4 flex items-start gap-2.5 rounded-card border border-brand/15 bg-brand-soft/70 px-4 py-3">
          <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-brand" />
          <p className="text-xs leading-relaxed text-gray-600">
            <span className="font-semibold text-gray-800">Your plan protects against duplicates.</span> Each guest can
            receive <span className="font-semibold">one invite per channel</span> (SMS and WhatsApp are separate). Failed
            sends stay pending so you can safely retry them.
          </p>
        </div>
      )}

      {bypassPayment && anyGuests && (
        <div className="mb-4 flex items-start gap-2.5 rounded-card border border-success/20 bg-success-soft px-4 py-3">
          <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-success" />
          <p className="text-xs leading-relaxed text-gray-600">
            <span className="font-semibold text-gray-800">Unlimited-send mode.</span> Send or resend any guest anytime on
            either channel — no per-guest limits, and failed sends stay retryable.
          </p>
        </div>
      )}

      {!anyGuests ? (
        <div className="rounded-[24px] border border-gray-200 bg-white shadow-elev-1">
          <AppEmptyState
            icon={<Inbox size={24} />}
            title="No guests yet"
            description="Add guests to this event before sending invitations."
            action={
              <AppButton
                variant="primary"
                onClick={() => router.push(`/client/guests/${eventId}`)}
                icon={<Users size={16} />}
              >
                Manage guests
              </AppButton>
            }
          />
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
          <motion.div variants={fadeUp} className="flex items-end justify-between gap-3 px-1">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Choose a channel</h3>
              <p className="text-[11px] text-gray-500">You can use both — each guest gets one invite per channel.</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-500">
              Step 1 of 3
            </span>
          </motion.div>

          {channels.map(({ key, pending, sent }) => {
            const meta = CHANNEL_META[key];
            const total = pending + sent;
            const percent = total > 0 ? Math.round((sent / total) * 100) : 0;
            const Icon = key === 'sms' ? Phone : MessageCircle;

            return (
              <motion.div key={key} variants={fadeUp}>
                <Link
                  href={`/client/invitations/send/${eventId}/${key}`}
                  className="group relative block overflow-hidden rounded-[22px] border border-gray-200/90 bg-white p-4 shadow-elev-1 transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-elev-3 active:translate-y-0 active:scale-[0.995] sm:p-5"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${meta.iconBg} text-white shadow-[0_8px_18px_-8px_rgba(13,75,75,0.55)] transition-transform duration-200 group-hover:scale-105 sm:h-14 sm:w-14`}
                    >
                      <Icon size={22} className="sm:h-6 sm:w-6" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-[15px] font-bold text-gray-900 sm:text-base">{meta.title}</h2>
                        {pending > 0 && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}>
                            {pending} ready
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">{meta.description}</p>
                    </div>

                    <ChevronRight
                      size={18}
                      className="mt-1 shrink-0 text-gray-300 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold">
                      <span style={{ color: meta.accent }}>{sent} delivered</span>
                      <span className="text-gray-400">{total} reachable</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(percent, sent > 0 ? 4 : 0)}%` }}
                        transition={{ duration: reduceMotion ? 0 : 0.6, ease: motionEase }}
                        className={`h-full rounded-full ${meta.progress}`}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-gray-700">
                      <Send size={13} className="shrink-0 text-gray-400" />
                      <span className="truncate">
                        {pending > 0 ? `${pending} invitation${pending === 1 ? '' : 's'} to send` : 'All caught up'}
                      </span>
                    </span>
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold text-white transition group-hover:gap-1.5"
                      style={{ backgroundColor: meta.accent }}
                    >
                      Open <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}

          <motion.div variants={fadeUp}>
            <Link
              href={`/client/invitations/sent/${eventId}`}
              className="flex items-center gap-3 rounded-[20px] border border-gray-200 bg-white px-4 py-3.5 shadow-elev-1 transition-all duration-200 hover:border-gray-300 hover:shadow-elev-2 active:scale-[0.995]"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
                <CheckCircle2 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">Sent invitations</p>
                <p className="truncate text-xs text-gray-500">
                  {smsSent.length + whatsappSent.length} delivered · resend or view details
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </Link>
          </motion.div>

          <motion.p variants={fadeUp} className="px-1 pt-1 text-center text-[11px] leading-relaxed text-gray-400">
            Tip: send a small batch first to confirm your card looks right, then send the rest.
          </motion.p>
        </motion.div>
      )}
    </div>
  );
}
