'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Send, MessageCircle, Info, ArrowRight, Image as ImageIcon, Languages } from 'lucide-react';
import {
  INVITE_TEMPLATES,
  getFullName,
  useGuestData,
  FlowSteps,
  FlowHeader,
  Card,
  LoadingState,
  SAMPLE_GUEST,
  cardTypeLabel,
} from '../../components/shared';

interface WaDraft {
  template?: string;
  vars?: Record<string, string>;
  contact?: string;
  eventType?: string;
}

const FIELDS = [
  { key: 'hostFamily', label: 'Host family', placeholder: 'Familia ya ...', hint: 'Appears after "Familia ya"' },
  { key: 'person1', label: 'Bridegroom', placeholder: 'e.g. Baraka', hint: '' },
  { key: 'person2', label: 'Bride', placeholder: 'e.g. Neema', hint: '' },
  { key: 'date', label: 'Date', placeholder: 'e.g. 12 Desemba 2026', hint: '' },
  { key: 'time', label: 'Time', placeholder: 'e.g. 10:00 asubuhi', hint: '' },
  { key: 'venue', label: 'Venue', placeholder: 'e.g. Calabar Hall, Dodoma', hint: '' },
] as const;

function readWhatsappDraft(eventId?: string): WaDraft | null {
  if (!eventId) return null;
  try {
    const saved = localStorage.getItem(`whatsapp_draft_${eventId}`);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed.template === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export default function ComposeWhatsappPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const id = Array.isArray(eventId) ? eventId[0] : eventId;
  const { event, loading, whatsappPending } = useGuestData(eventId);

  const [template, setTemplate] = useState(() => readWhatsappDraft(id)?.template || 'mwalikoforth');
  const [vars, setVars] = useState<Record<string, string>>(() => readWhatsappDraft(id)?.vars || {});
  const [contact, setContact] = useState(() => readWhatsappDraft(id)?.contact || '');
  const [eventType, setEventType] = useState(() => {
    const e = readWhatsappDraft(id)?.eventType;
    return e || 'harusi';
  });

  const currentTpl = INVITE_TEMPLATES[template];

  // ─── Auto-save draft ───────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => {
      try {
        const draft: WaDraft = { template, vars, contact, eventType };
        localStorage.setItem(`whatsapp_draft_${id}`, JSON.stringify(draft));
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(t);
  }, [template, vars, contact, eventType, id]);

  // ─── Effective values: event defaults, overridden by user edits ─────────
  const effectiveVars = useMemo(() => {
    const date = event?.date
      ? new Date(event.date).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    return {
      hostFamily: event?.hostFamily || '',
      person1: event?.person1 || '',
      person2: event?.person2 || '',
      date,
      time: event?.time || '',
      venue: event?.venue || '',
      ...vars,
    };
  }, [event, vars]);

  const preview = useMemo(() => {
    const couple =
      effectiveVars.person1 && effectiveVars.person2
        ? `${effectiveVars.person1} na ${effectiveVars.person2}`
        : effectiveVars.person1 || effectiveVars.person2;
    const name = getFullName(SAMPLE_GUEST);
    const cardNumber = SAMPLE_GUEST.cardNumber || '';
    const cardType = cardTypeLabel(SAMPLE_GUEST);
    if (template === 'mwalikoforth') {
      return [
        `Habari ${name}`,
        '',
        `Familia ya ${effectiveVars.hostFamily || '{hostFamily}'} inakualika katika ${eventType || 'harusi'} ya ${couple || '...'} itakayofanyika tarehe ${effectiveVars.date || '{date}'}`,
        `Mahali: ${effectiveVars.venue || '{venue}'}`,
        `Muda: Kuanzia saa ${effectiveVars.time || '{time}'}`,
        `Card No: ${cardNumber} ${cardType}`,
        ...(contact ? [`kwa mawasiliano zaidi: ${contact}`] : []),
        '',
        'Tafadhali hakikisha unatunza kadi hii kwaajili ya matumizi ya ukumbini. Ahsante',
      ].join('\n');
    }
    return [
      `Habari ${name}`,
      '',
      `Familia ya ${effectiveVars.hostFamily || '{hostFamily}'} inakualika katika harusi ya ${effectiveVars.person1 || '{person1}'} na ${effectiveVars.person2 || '{person2}'}`,
      '',
      `itakayofanyika tarehe: ${effectiveVars.date || '{date}'}`,
      `Mahali: ${effectiveVars.venue || '{venue}'}`,
      `Muda: Kuanzia saa ${effectiveVars.time || '{time}'}`,
      '',
      `Card No: ${cardNumber}`,
      `${cardType}`,
      ...(currentTpl.hasContact && contact ? [`kwa mawasiliano zaidi: ${contact}`] : []),
    ].join('\n');
  }, [template, effectiveVars, contact, eventType, currentTpl]);

  if (loading) return <LoadingState label="Loading WhatsApp..." />;

  const continueUrl = `/client/invitations/send/${id}/whatsapp/guests`;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <FlowHeader backUrl={`/client/invitations/send/${id}`} title="WhatsApp message" subtitle={event?.name} />
      <FlowSteps current={2} />

      {/* ─── Template picker ─── */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={17} className="text-[#15803d]" />
          <h2 className="font-semibold text-gray-800">Choose a template</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          WhatsApp only allows pre-approved templates. Each one includes the wedding card image and a confirm link.
        </p>
        <div className="space-y-2">
          {Object.entries(INVITE_TEMPLATES).map(([key, tpl]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTemplate(key)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition ${
                template === key
                  ? 'border-[#25D366] bg-[#25D366]/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full border-2 grid place-items-center flex-shrink-0 ${
                  template === key ? 'border-[#25D366]' : 'border-gray-300'
                }`}
              >
                {template === key && <span className="w-2.5 h-2.5 bg-[#25D366] rounded-full" />}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-gray-900">{tpl.displayName}</span>
                <span className="block text-[11px] text-gray-500">
                  {tpl.hasEventType
                    ? 'Includes event type (harusi/arusi)'
                    : tpl.hasContact
                      ? 'Includes a contact line'
                      : 'Extra contact info not included'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* ─── Variables ─── */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Languages size={17} className="text-[#0D4B4B]" />
          <h2 className="font-semibold text-gray-800">Message details</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          These appear in every message. The guest&apos;s name, card number and card type are filled in automatically.
        </p>

        <div className="space-y-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-gray-600">{f.label}</label>
              <input
                value={effectiveVars[f.key] || ''}
                onChange={e => setVars(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
              />
            </div>
          ))}

          {currentTpl.hasEventType && (
            <div>
              <label className="text-xs font-medium text-gray-600">Event type</label>
              <input
                value={eventType}
                onChange={e => setEventType(e.target.value)}
                placeholder="harusi"
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
              />
            </div>
          )}

          {currentTpl.hasContact && (
            <div>
              <label className="text-xs font-medium text-gray-600">Contact number to add</label>
              <input
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder="e.g. +255 712 345 678"
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
              />
            </div>
          )}
        </div>
      </Card>

      {/* ─── Preview ─── */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <ImageIcon size={17} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800">Preview</h2>
        </div>
        <div className="mt-2 p-4 bg-[#e7f7ec] rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center">
              <MessageCircle size={16} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-800">Wedding Invitation</p>
              <p className="text-[10px] text-gray-500">Sample · for {getFullName(SAMPLE_GUEST)}</p>
            </div>
          </div>
          <div
            className="bg-white rounded-xl p-3.5 text-[13px] text-gray-700 whitespace-pre-wrap"
            style={{ lineHeight: '1.55' }}
          >
            {preview}
          </div>
          <div className="mt-2 rounded-lg bg-[#25D366] text-white text-center text-xs font-semibold py-1.5 px-3 inline-block">
            Confirm
          </div>
        </div>
      </Card>

      {/* ─── Continue ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <button
          type="button"
          onClick={() => router.push(continueUrl)}
          className="w-full py-3.5 bg-[#25D366] text-white rounded-2xl font-semibold text-sm hover:bg-[#1db356] transition flex items-center justify-center gap-2"
        >
          <Send size={16} />
          Choose guests
          <span className="bg-white/25 text-[10px] px-2 py-0.5 rounded-full">{whatsappPending.length} to send</span>
          <ArrowRight size={16} />
        </button>
        <div className="mt-2 flex items-start gap-1.5 justify-center">
          <Info size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-center text-[11px] text-gray-400">
            Only guests who haven&apos;t received a WhatsApp invitation yet will be listed.
          </p>
        </div>
      </motion.div>
    </div>
  );
}