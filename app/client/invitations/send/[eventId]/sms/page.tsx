'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Send, Eye, EyeOff, Info, FileText, ArrowRight, Save, CheckCircle2 } from 'lucide-react';
import SmsCounter from '@/components/SmsCounter';
import { MAX_SMS_PARTS_PER_GUEST } from '@/lib/sms/units';
import {
  SMS_VARIABLES,
  SAMPLE_GUEST,
  DEFAULT_SMS_TEMPLATE,
  buildSmsMessage,
  useGuestData,
  FlowSteps,
  FlowHeader,
  VariableChip,
  Card,
  LoadingState,
} from '../../components/shared';
import { useMessageDrafts } from '@/lib/messageDrafts';

export default function ComposeSmsPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const id = Array.isArray(eventId) ? eventId[0] : eventId;
  const { event, loading, smsPending, bypassPayment } = useGuestData(eventId);
  const { drafts, ready: draftsReady, saveStatus, set } = useMessageDrafts(id);

  const smsTemplate = drafts.smsTemplate ?? DEFAULT_SMS_TEMPLATE;
  const [showVariables, setShowVariables] = useState(true);
  const [showPreview, setShowPreview] = useState(true);

  const preview = useMemo(() => buildSmsMessage(smsTemplate, SAMPLE_GUEST), [smsTemplate]);

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('sms-template-editor') as HTMLTextAreaElement | null;
    const start = textarea?.selectionStart ?? smsTemplate.length;
    const end = textarea?.selectionEnd ?? smsTemplate.length;
    const next = smsTemplate.slice(0, start) + variable + smsTemplate.slice(end);
    set('smsTemplate', next);
    setTimeout(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + variable.length, start + variable.length);
    }, 10);
  };

  if (loading || !draftsReady) return <LoadingState label="Loading SMS..." />;

  const continueUrl = `/client/invitations/send/${id}/sms/guests`;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <FlowHeader backUrl={`/client/invitations/send/${id}`} title="SMS message" subtitle={event?.name} />
      <FlowSteps current={2} />

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={17} className="text-brandtext" />
          <h2 className="font-semibold text-gray-800">Write your invitation</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Type the message below and tap a variable to insert the guest&apos;s details. The same message goes to every
          guest with their own name, card number and card type filled in.
        </p>

        {/* ─── 3 variables ─── */}
        <button
          type="button"
          onClick={() => setShowVariables(v => !v)}
          className="text-xs font-medium text-brandtext hover:text-brand-deeptext mb-2 flex items-center gap-1"
        >
          <Info size={13} />
          {showVariables ? 'Hide variables' : 'Show variables'}
        </button>

        <div className={`flex flex-wrap gap-2 mb-4 ${showVariables ? '' : 'hidden'}`}>
          {SMS_VARIABLES.map(v => (
            <VariableChip key={v.key} variable={v} onInsert={() => insertVariable(v.key)} />
          ))}
        </div>

        {/* ─── Editor ─── */}
        <textarea
          id="sms-template-editor"
          value={smsTemplate}
          onChange={e => set('smsTemplate', e.target.value)}
          className="w-full p-4 border border-gray-200 rounded-card text-sm font-mono focus:ring-2 focus:ring-brandring focus:border-transparent min-h-[220px] resize-y"
          placeholder="Write your SMS invitation here..."
        />
        <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <Save size={11} className="text-green-500" />{' '}
            {saveStatus === 'saving'
              ? 'Saving to your account…'
              : saveStatus === 'error'
                ? 'Offline — will retry'
                : 'Saved to your account'}
          </span>
          <SmsCounter text={preview} maxParts={bypassPayment ? null : MAX_SMS_PARTS_PER_GUEST} />
        </div>

        {/* ─── Preview ─── */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowPreview(v => !v)}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPreview ? 'Hide preview' : 'Show preview'}
          </button>
          {showPreview && (
            <div className="mt-2 p-4 bg-gray-50 rounded-card border border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Example · for Mr John Doe
              </p>
              <div
                className="bg-white rounded-tap border border-gray-100 p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap max-h-56 overflow-y-auto"
                style={{ lineHeight: '1.6' }}
              >
                {preview}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ─── Continue ─── */}
      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <button
          type="button"
          onClick={() => router.push(continueUrl)}
          disabled={!smsTemplate.trim()}
          className="w-full py-3.5 bg-brandbg text-white rounded-card font-semibold text-sm hover:bg-brand-deepbg transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Send size={16} />
          Choose guests
          <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full">{smsPending.length} to send</span>
          <ArrowRight size={16} />
        </button>
        <p className="text-center text-[11px] text-gray-400 mt-2 flex items-center justify-center gap-1">
          <CheckCircle2 size={12} className="text-[#1A7A4A]" /> Only guests who haven&apos;t received an SMS yet will
          be listed.
        </p>
      </motion.div>
    </div>
  );
}