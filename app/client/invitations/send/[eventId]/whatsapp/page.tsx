'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Send, MessageCircle, Info, ArrowRight, Image as ImageIcon, Languages, CheckCircle2 } from 'lucide-react';
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
import { useMessageDrafts } from '@/lib/messageDrafts';

interface WaDraft {
  template?: string;
  vars?: Record<string, string>;
  contact?: string;
  contact2?: string;
  eventType?: string;
}

const FIELDS = [
  { key: 'hostFamily', label: 'Host family', placeholder: 'e.g. Mr & Mrs Wambura', hint: '' },
  { key: 'person1', label: 'Person 1 (celebrant)', placeholder: 'e.g. Norah Cyprian', hint: '' },
  { key: 'person2', label: 'Person 2 (optional)', placeholder: 'e.g. Ngiliule', hint: 'Leave blank for single-person events' },
  { key: 'date', label: 'Date', placeholder: 'e.g. 03/09/2026, Alhamisi', hint: '' },
  { key: 'time', label: 'Time', placeholder: 'e.g. Saa 12:00 Jioni', hint: '' },
  { key: 'venue', label: 'Venue', placeholder: 'e.g. Galilaya Hall, Garage - Ubungo', hint: '' },
] as const;

export default function ComposeWhatsappPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const id = Array.isArray(eventId) ? eventId[0] : eventId;
  const { event, loading, whatsappPending } = useGuestData(eventId);
  const { drafts, ready: draftsReady, set } = useMessageDrafts(id);

  // WhatsApp drafts live on the account (Event -> tenant), so whatever is
  // typed here reappears on any device signed into the same tenant.
  const draft: WaDraft | null = (drafts.whatsappInviteDraft as WaDraft | null);
  const template = draft?.template || 'mwalikoforth';
  const vars = useMemo(() => draft?.vars ?? {}, [draft?.vars]);
  const contact = draft?.contact || '';
  const contact2 = draft?.contact2 || '';
  const eventType = draft?.eventType || 'harusi';
  const setTemplate = (value: string) => set('whatsappInviteDraft', { ...draft, template: value });
  const setVars = (updater: (prev: Record<string, string>) => Record<string, string>) =>
    set('whatsappInviteDraft', { ...draft, vars: updater(draft?.vars || {}) });
  const setContact = (value: string) => set('whatsappInviteDraft', { ...draft, contact: value });
  const setContact2 = (value: string) => set('whatsappInviteDraft', { ...draft, contact2: value });
  const setEventType = (value: string) => set('whatsappInviteDraft', { ...draft, eventType: value });

  const currentTpl = INVITE_TEMPLATES[template];

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
      area: event?.address || '',
      ...vars,
    };
  }, [event, vars]);

  // Preview for the selected template + mini previews for every card in the
  // picker, built from the tenant's real event details so choosing is visual.
  const allPreviews = useMemo(() => {
    const couple =
      effectiveVars.person1 && effectiveVars.person2
        ? `${effectiveVars.person1} na ${effectiveVars.person2}`
        : effectiveVars.person1 || effectiveVars.person2;
    const name = getFullName(SAMPLE_GUEST);
    const cardNumber = SAMPLE_GUEST.cardNumber || '';
    const cardType = cardTypeLabel(SAMPLE_GUEST);

    const build = (key: string): string => {
      const tpl = INVITE_TEMPLATES[key];
      if (key === 'mwalikoplus') {
        return [
          `Habari ${name}`,
          '',
          `Familia ya ${effectiveVars.hostFamily || '{hostFamily}'} wa ${effectiveVars.area || '{area}'} inakualika katika ${eventType || 'harusi'} ${couple || '...'}`,
          `itakayofanyika tarehe ${effectiveVars.date || '{date}'}`,
          `Ukumbi: ${effectiveVars.venue || '{venue}'}`,
          `Muda: ${effectiveVars.time || '{time}'}`,
          `Card No: ${cardNumber} ${cardType}`,
          ...(contact ? [`kwa mawasiliano zaidi: ${contact}${contact2 ? ` | ${contact2}` : ''}`] : []),
          '',
          'Tafadhali hakikisha unatunza kadi hii kwaajili ya matumizi ya ukumbini. Ahsante.',
          '',
          'Bonyeza Link Hapa Chini kwa kwa Maelezo zaidi👇️',
        ].join('\n');
      }
      if (key === 'mwalikoforth') {
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
      if (key === 'mdakumbe') {
        return [
          'Event: KADI YA MUALIKO UKUMBINI',
          `Mr. Mkoloma anakualika Ndg. ${SAMPLE_GUEST.name} kwenye Usiku wa Blue & White. Tutazindua Logo ya MDAKUMBE TV na BIRTHDAY PARTY NIGHT.`,
          'Tarehe: 23/10/2026',
          'Ukumbi: CCM HALL - MIKINDANI',
          'Muda: Kuanzia Saa 12:30 Jioni',
          `Card No: ${cardNumber}`,
          'Kufika kwako ndio Mafanikio ya Mdakumbe TV, SISI NI WEWE, TUMEKUFIKIA',
          'Mawasiliano: Whatsapp - 0716143510, Call - 0613453510',
          'Tafadhali Tunza Kadi hii kwaajili ya Matumizi ya Ukumbini, Asante!!',
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
        ...(tpl.hasContact && contact ? [`kwa mawasiliano zaidi: ${contact}`] : []),
      ].join('\n');
    };

    const out: Record<string, string> = {};
    for (const key of Object.keys(INVITE_TEMPLATES)) out[key] = build(key);
    return out;
  }, [effectiveVars, contact, contact2, eventType]);

  const preview = allPreviews[template];

  if (loading || !draftsReady) return <LoadingState label="Loading WhatsApp..." />;

  const continueUrl = `/client/invitations/send/${id}/whatsapp/guests`;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <FlowHeader backUrl={`/client/invitations/send/${id}`} title="WhatsApp message" subtitle={event?.name} />
      <FlowSteps current={2} />

      {/* ─── Template picker ─── */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={17} className="text-successtext" />
          <h2 className="font-semibold text-gray-800">Choose a template</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          WhatsApp only allows pre-approved templates. Tap one to preview it — each includes the guest&apos;s card image, and some add a link button to their unique card page.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(INVITE_TEMPLATES).map(([key, tpl]) => {
            const selected = template === key;
            const snippet = (allPreviews[key] || '').split('\n').slice(0, 3).join('\n');
            return (
              <motion.button
                key={key}
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => setTemplate(key)}
                aria-pressed={selected}
                className={`w-full text-left rounded-card border p-3.5 transition ${
                  selected
                    ? 'border-[#25D366] bg-[#25D366]/5 ring-2 ring-[#25D366]/15'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 leading-snug">{tpl.displayName}</span>
                  {selected && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#25D366] text-white grid place-items-center">
                      <CheckCircle2 size={13} />
                    </span>
                  )}
                </div>
                <div
                  className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed whitespace-pre-line line-clamp-3 ${
                    selected
                      ? 'border-[#25D366]/20 bg-white text-gray-700'
                      : 'border-gray-100 bg-gray-50 text-gray-500'
                  }`}
                >
                  {snippet}
                </div>
                {(tpl.hasMoreInfoButton || tpl.hasEventType || tpl.hasContact || tpl.hasContact2) && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {tpl.hasMoreInfoButton && (
                      <span className="text-[10px] font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                        More Info
                      </span>
                    )}
                    {tpl.hasEventType && (
                      <span className="text-[10px] font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                        Event type
                      </span>
                    )}
                    {tpl.hasContact && (
                      <span className="text-[10px] font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                        Contact line
                      </span>
                    )}
                    {tpl.hasContact2 && (
                      <span className="text-[10px] font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                        2nd contact
                      </span>
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </Card>

      {/* ─── Variables ─── */}
      {currentTpl.hasComposeFields !== false && (
        <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Languages size={17} className="text-brandtext" />
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
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-tap text-sm focus:ring-2 focus:ring-brandring focus:border-transparent"
              />
            </div>
          ))}

          {currentTpl.hasMoreInfoButton && (
            <div>
              <label className="text-xs font-medium text-gray-600">Area / Location</label>
              <input
                value={effectiveVars.area || ''}
                onChange={e => setVars(v => ({ ...v, area: e.target.value }))}
                placeholder="e.g. Tabata Kimanga - Dar es salaam"
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-tap text-sm focus:ring-2 focus:ring-brandring focus:border-transparent"
              />
            </div>
          )}

          {currentTpl.hasEventType && (
            <div>
              <label className="text-xs font-medium text-gray-600">Event type</label>
              <input
                value={eventType}
                onChange={e => setEventType(e.target.value)}
                placeholder="e.g. SendOff ya Binti yao mpendwa"
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-tap text-sm focus:ring-2 focus:ring-brandring focus:border-transparent"
              />
            </div>
          )}

          {currentTpl.hasContact && (
            <div>
              <label className="text-xs font-medium text-gray-600">Contact number to add</label>
              <input
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder="e.g. John Pambalu: 0769999902"
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-tap text-sm focus:ring-2 focus:ring-brandring focus:border-transparent"
              />
            </div>
          )}

          {currentTpl.hasContact2 && (
            <div>
              <label className="text-xs font-medium text-gray-600">Second contact number</label>
              <input
                value={contact2}
                onChange={e => setContact2(e.target.value)}
                placeholder="e.g. Hamza Pambalu: 0655552033"
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-tap text-sm focus:ring-2 focus:ring-brandring focus:border-transparent"
              />
            </div>
          )}
        </div>
        </Card>
      )}

      {/* ─── Preview ─── */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <ImageIcon size={17} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800">Preview</h2>
        </div>
        <div className="mt-2 p-4 bg-[#e7f7ec] rounded-card">
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
            className="bg-white rounded-tap p-3.5 text-[13px] text-gray-700 whitespace-pre-wrap"
            style={{ lineHeight: '1.55' }}
          >
            {preview}
          </div>
          <div className="mt-2 rounded-lg bg-[#25D366] text-white text-center text-xs font-semibold py-1.5 px-3 inline-block">
            {template === 'mwalikoplus' ? 'Maelezo Zaidi' : 'Confirm'}
          </div>
        </div>
      </Card>

      {/* ─── Continue ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <button
          type="button"
          onClick={() => router.push(continueUrl)}
          className="w-full py-3.5 bg-[#25D366] text-white rounded-card font-semibold text-sm hover:bg-[#1db356] transition flex items-center justify-center gap-2"
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