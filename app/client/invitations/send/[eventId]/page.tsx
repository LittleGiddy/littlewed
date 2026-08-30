'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Phone, MessageCircle, CheckCircle2, Users, ChevronRight, ShieldCheck, ArrowRight, Inbox } from 'lucide-react';
import { useGuestData, FlowSteps, FlowHeader, LoadingState, NeedCardsBanner } from '../components/shared';

export default function SendChannelPickerPage() {
  const { eventId } = useParams();
  const { event, loading, smsPending, whatsappPending, smsSent, whatsappSent, missingCards, bypassPayment } =
    useGuestData(eventId);

  if (loading) return <LoadingState label="Loading invitations..." />;

  const totalGuests = smsPending.length + smsSent.length;
  const anyGuests = totalGuests > 0;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <FlowHeader
        backUrl={`/client/events/${eventId}`}
        title="Send Invitations"
        subtitle={event?.name ? `${event.name} · ${totalGuests} guests` : undefined}
      />
      <FlowSteps current={1} />

      {missingCards.length > 0 && (
        <div className="mb-5">
          <NeedCardsBanner count={missingCards.length} />
        </div>
      )}

      {!bypassPayment && anyGuests && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-[#0D4B4B]/10 bg-[#0D4B4B]/[0.03] px-4 py-3">
          <ShieldCheck size={16} className="text-[#0D4B4B] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-800">Your plan protects against duplicates.</span> Each guest can
            receive <span className="font-semibold">one invite per channel</span> (SMS and WhatsApp are separate). If a
            send fails, it stays &quot;pending&quot; so you can safely retry just the failed ones.
          </p>
        </div>
      )}

      {bypassPayment && anyGuests && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-[#1A7A4A]/20 bg-[#1A7A4A]/[0.06] px-4 py-3">
          <ShieldCheck size={16} className="text-[#1A7A4A] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-800">Unlimited-send mode.</span> You can send or resend any guest
            anytime on either channel — no per-guest send limits, and failed sends stay retryable.
          </p>
        </div>
      )}

      {!anyGuests ? (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm px-6 py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Inbox size={26} className="text-gray-400" />
          </div>
          <p className="font-semibold text-gray-800">No guests yet</p>
          <p className="text-sm text-gray-500 mt-1 mb-5">Add guests to this event before sending invitations.</p>
          <Link
            href={`/client/guests/${eventId}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0D4B4B] text-white rounded-xl font-semibold text-sm hover:bg-[#0A3939] transition"
          >
            <Users size={16} /> Manage guests
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ─── SMS card ─── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Link
              href={`/client/invitations/send/${eventId}/sms`}
              className="block bg-white rounded-3xl border border-gray-200 shadow-sm hover:border-[#0D4B4B] hover:shadow-md transition p-5 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center text-white flex-shrink-0">
                  <Phone size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-bold text-gray-900 text-base">Send via SMS</h2>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-[#0D4B4B] group-hover:translate-x-0.5 transition" />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Plain-text invitation with the guest&apos;s card details. No templates.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="rounded-xl bg-[#0D4B4B]/5 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-[#0D4B4B]">{smsPending.length}</p>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">To send</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{smsSent.length}</p>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Sent</p>
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D4B4B]">
                Continue <ArrowRight size={13} />
              </div>
            </Link>
          </motion.div>

          {/* ─── WhatsApp card ─── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.06 }}>
            <Link
              href={`/client/invitations/send/${eventId}/whatsapp`}
              className="block bg-white rounded-3xl border border-gray-200 shadow-sm hover:border-[#25D366] hover:shadow-md transition p-5 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#25D366] flex items-center justify-center text-white flex-shrink-0">
                  <MessageCircle size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-bold text-gray-900 text-base">Send via WhatsApp</h2>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-[#25D366] group-hover:translate-x-0.5 transition" />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Approved template with the card image and a confirm link.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="rounded-xl bg-[#25D366]/10 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-[#15803d]">{whatsappPending.length}</p>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">To send</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{whatsappSent.length}</p>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Sent</p>
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803d]">
                Continue <ArrowRight size={13} />
              </div>
            </Link>
          </motion.div>

          {/* ─── Sent invitations ─── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.12 }}>
            <Link
              href={`/client/invitations/sent/${eventId}`}
              className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-[#0D4B4B] hover:shadow-md transition px-4 py-4"
            >
              <div className="w-10 h-10 rounded-xl bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B] flex-shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">Sent invitations</p>
                <p className="text-xs text-gray-500">
                  {smsSent.length + whatsappSent.length} guests delivered · resend or view details
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </Link>
          </motion.div>
        </div>
      )}
    </div>
  );
}