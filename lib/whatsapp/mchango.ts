// Builds the variable payload for the approved "Mchango" WhatsApp template.
//
// The template is a broadcast body — {var1}..{var13} are event-level values
// (occasion, names, venue, dates, payment instructions, contact), not
// per-guest ones. Personalisation for an individual guest comes from the
// reminder card attached as the template header image, which is why the
// payload is built once per send rather than once per guest.
//
// Approved template:
//   MCHANGO WA {var1}, Habari {var2}, ... {var13}. Ahsante!!! .
//
// Every value must be a string: NexSMS rejects non-strings. Missing event data
// degrades to an em dash rather than sending the literal placeholder, because
// a message reading "tarehe —" is worse than one reading "tarehe 25 Novemba".

export interface MchangoEventSource {
  name: string;
  eventType?: string | null;
  hostFamily?: string | null;
  person1?: string | null;
  person2?: string | null;
  venue?: string | null;
  address?: string | null;
  date: Date | string;
  contributionDeadline?: Date | string | null;
  mpesaInstructions?: string | null;
  airtelInstructions?: string | null;
  bankInstructions?: string | null;
  contactPerson?: string | null;
  contactPersonPhone?: string | null;
  tenant?: { name?: string | null; whatsappAccount?: string | null } | null;
}

const DASH = '—';

function text(value: string | null | undefined, fallback = DASH): string {
  const trimmed = (value ?? '').toString().trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/** "25 Novemba 2026" — the long Tanzanian month names the template expects. */
const SW_MONTHS = [
  'Januari',
  'Februari',
  'Machi',
  'Aprili',
  'Mei',
  'Juni',
  'Julai',
  'Agosti',
  'Septemba',
  'Oktoba',
  'Novemba',
  'Desemba',
];

export function formatSwahiliDate(value: Date | string | null | undefined): string {
  if (!value) return DASH;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return DASH;
  return `${d.getDate()} ${SW_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Familia ya X" — the family name, preferring the explicit host family. */
function resolveFamilyName(event: MchangoEventSource): string {
  const hostFamily = (event.hostFamily ?? '').trim();
  if (hostFamily) return hostFamily;
  const parts = [event.person1, event.person2].map((p) => (p ?? '').trim()).filter(Boolean);
  if (parts.length === 2) return `${parts[0]} & ${parts[1]}`;
  return parts[0] ?? '';
}

/** "MCHANGO" is the reminder subject; var1 is the occasion it is for. */
function resolveOccasion(event: MchangoEventSource): string {
  return (event.eventType ?? '').trim() || 'Mchango';
}

/**
 * Build the var1..var13 personalisation record for the "Mchango" template.
 * Returns a single-entry array, which is the shape `personalisation` expects.
 */
export function buildMchangoPersonalisation(
  event: MchangoEventSource
): Record<string, string>[] {
  const occasion = resolveOccasion(event);
  const familyName = resolveFamilyName(event);

  // var2 greets the couple, var3 names the family. When only one name exists
  // both slots repeat it so the sentence still reads naturally.
  const primaryName = familyName || (event.name ?? '').trim();

  const contactPhone = text(event.contactPersonPhone, '');
  const contactName = (event.tenant?.name ?? '').trim() || 'LittleWed';
  const var13 = contactPhone ? `${contactPhone} - ${contactName}` : contactName;

  return [
    {
      var1: occasion,
      var2: text(primaryName, DASH),
      var3: text(familyName || primaryName, DASH),
      var4: text(event.venue, DASH),
      var5: text(event.name, DASH),
      var6: text(event.person2 || event.person1 || familyName, DASH),
      var7: formatSwahiliDate(event.date),
      var8: text(event.address, DASH),
      var9: formatSwahiliDate(event.contributionDeadline),
      var10: text(event.mpesaInstructions, DASH),
      var11: text(event.airtelInstructions, DASH),
      var12: text(event.bankInstructions, DASH),
      var13: var13,
    },
  ];
}

/** NexSMS template name for the approved contribution reminder. */
export const MCHANGO_TEMPLATE_DEFAULT = 'Mchango';

export function getMchangoTemplate(): string {
  return process.env.REMINDER_WHATSAPP_TEMPLATE || MCHANGO_TEMPLATE_DEFAULT;
}
