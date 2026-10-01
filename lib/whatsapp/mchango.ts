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
}

const DASH = '—';

// ─── Variable catalogue ─────────────────────────────────────────────────
//
// Single source of truth for the var1..var13 slots. The editor UI renders its
// fields straight from this list and the send path reads the same keys, so a
// field can never appear in the form without a matching slot in the payload
// (or the other way round).
//
// `fromEvent` marks a slot that already has a home on the Event row: the form
// still lets the tenant override it for this send, but the event remains the
// source of truth so the tracker and the invitation cannot drift.

export type MchangoFieldKey =
  | 'occasion'
  | 'greetingName'
  | 'familyName'
  | 'venue'
  | 'eventName'
  | 'celebrant'
  | 'date'
  | 'address'
  | 'deadline'
  | 'mpesa'
  | 'airtel'
  | 'bank'
  | 'contact';

export interface MchangoFieldSpec {
  key: MchangoFieldKey;
  /** The literal template slot this field fills. */
  varKey: 'var1' | 'var2' | 'var3' | 'var4' | 'var5' | 'var6' | 'var7' | 'var8' | 'var9' | 'var10' | 'var11' | 'var12' | 'var13';
  label: string;
  labelSw: string;
  hint: string;
  placeholder: string;
  group: 'occasion' | 'details' | 'payment' | 'contact';
  kind: 'text' | 'date' | 'select' | 'tel';
  /** Event column that seeds the default, if any. */
  fromEvent?: string;
  options?: readonly string[];
}

export const MCHANGO_OCCASIONS = [
  'Send-Off',
  'Wedding',
  'Introduction',
  'Baby Shower',
  'Graduation',
  'Other',
] as const;

export const MCHANGO_FIELD_GROUPS = [
  { key: 'occasion', label: 'Occasion & people', description: 'Who the contribution is for.' },
  { key: 'details', label: 'Event details', description: 'Usually inherited from the event.' },
  { key: 'payment', label: 'How to pay', description: 'These reach the guest in the message.' },
  { key: 'contact', label: 'Contact', description: 'Who to ask when they need help.' },
] as const;

export const MCHANGO_FIELDS: readonly MchangoFieldSpec[] = [
  {
    key: 'occasion',
    varKey: 'var1',
    label: 'Occasion',
    labelSw: 'Shughuli',
    hint: 'The event the contribution is for.',
    placeholder: 'Send-Off',
    group: 'occasion',
    kind: 'select',
    fromEvent: 'eventType',
    options: MCHANGO_OCCASIONS,
  },
  {
    key: 'greetingName',
    varKey: 'var2',
    label: 'Greeting name',
    labelSw: 'Jina la salamu',
    hint: 'Who the message opens with. Defaults to the family name.',
    placeholder: 'Familia ya Mkumbo',
    group: 'occasion',
    kind: 'text',
  },
  {
    key: 'familyName',
    varKey: 'var3',
    label: 'Family name',
    labelSw: 'Jina la familia',
    hint: 'Filled in from the host family or the two names.',
    placeholder: 'Familia ya Mkumbo',
    group: 'occasion',
    kind: 'text',
    fromEvent: 'hostFamily',
  },
  {
    key: 'venue',
    varKey: 'var4',
    label: 'Venue',
    labelSw: 'Mahali',
    hint: 'From the event.',
    placeholder: 'Garden Paradise, Dar es Salaam',
    group: 'details',
    kind: 'text',
    fromEvent: 'venue',
  },
  {
    key: 'eventName',
    varKey: 'var5',
    label: 'Event name',
    labelSw: 'Jina la shughuli',
    hint: 'From the event.',
    placeholder: 'Send-Off ya Neema na Kelvin',
    group: 'details',
    kind: 'text',
    fromEvent: 'name',
  },
  {
    key: 'celebrant',
    varKey: 'var6',
    label: 'Second name',
    labelSw: 'Jina la pili',
    hint: 'The celebrant or partner. Defaults to the first name.',
    placeholder: 'Neema',
    group: 'occasion',
    kind: 'text',
    fromEvent: 'person1',
  },
  {
    key: 'date',
    varKey: 'var7',
    label: 'Event date',
    labelSw: 'Tarehe ya shughuli',
    hint: 'From the event.',
    placeholder: '25 Novemba 2026',
    group: 'details',
    kind: 'date',
    fromEvent: 'date',
  },
  {
    key: 'address',
    varKey: 'var8',
    label: 'Address',
    labelSw: 'Anwani',
    hint: 'From the event.',
    placeholder: 'Kigamboni, Dar es Salaam',
    group: 'details',
    kind: 'text',
    fromEvent: 'address',
  },
  {
    key: 'deadline',
    varKey: 'var9',
    label: 'Payment deadline',
    labelSw: 'Tarehe ya malipo',
    hint: 'The date contributions are due. (set on the Reminders screen)',
    placeholder: '20 Novemba 2026',
    group: 'payment',
    kind: 'date',
    fromEvent: 'contributionDeadline',
  },
  {
    key: 'mpesa',
    varKey: 'var10',
    label: 'M-Pesa',
    labelSw: 'M-Pesa',
    hint: 'Number and name on the account.',
    placeholder: 'M-Pesa: 0762208760 - MAGRETH MKUMBI',
    group: 'payment',
    kind: 'text',
    fromEvent: 'mpesaInstructions',
  },
  {
    key: 'airtel',
    varKey: 'var11',
    label: 'Airtel Money',
    labelSw: 'Airtel Money',
    hint: 'Optional.',
    placeholder: 'Airtel Money: 0788161381 - MAGRETH MKUMBI',
    group: 'payment',
    kind: 'text',
    fromEvent: 'airtelInstructions',
  },
  {
    key: 'bank',
    varKey: 'var12',
    label: 'Bank',
    labelSw: 'Benki',
    hint: 'Optional.',
    placeholder: 'CRDB BANK: 0152546773500 - MAGRETH MK',
    group: 'payment',
    kind: 'text',
    fromEvent: 'bankInstructions',
  },
  {
    key: 'contact',
    varKey: 'var13',
    label: 'Contact for questions',
    labelSw: 'Mawasiliano',
    hint: 'Number and who to ask for. Defaults to your business name.',
    placeholder: '0754321098 - LittleWed',
    group: 'contact',
    kind: 'tel',
    fromEvent: 'contactPersonPhone',
  },
] as const;

/**
 * The preview mirrors the approved NexSMS template. The provider holds the
 * authoritative body; this exists so the tenant can see their edits.
 *
 * var6 carries the celebrant in the opening line rather than in the body,
 * because the event name (var5) usually already contains both names and
 * "…kwa ajili ya <event name> ya <name>" reads as a stutter.
 */
export const MCHANGO_PREVIEW_BODY = [
  'MCHANGO WA {var1} ya {var6},',
  '',
  'Habari {var2},',
  '',
  '{var3} inaomba msaada wako kwa ajili ya {var5},',
  'itakayofanyika tarehe {var7} mahali {var4}, {var8}.',
  '',
  'Mchango unaweza kulipwa kwa njia zifuatazo:',
  '{var10}',
  '{var11}',
  '{var12}',
  '',
  'Tunapenda mchango ukamilishae tarehe {var9}.',
  '',
  'Kwa mawasiliano zaidi wasiliana na {var13}.',
  '',
  'Asante sana!',
].join('\n');

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
  const parts = [event.person1, event.person2].map((p) => (p ?? '').trim()).filter(Boolean);
  const derived = parts.length === 2 ? `${parts[0]} & ${parts[1]}` : (parts[0] ?? '');

  const family = hostFamily || derived;
  if (!family) return '';
  // The body already reads "{var3} inaomba…", so the slot has to carry the
  // "Familia ya" lead-in itself. Tenants type either form, so normalise rather
  // than printing "Familia ya Familia ya Mkumbo".
  return /^familia\b/i.test(family) ? family : `Familia ya ${family}`;
}

/**
 * var1 is the occasion. Left empty when the tenant has not chosen one so the
 * editor flags it as missing — a silent "MCHANGO WA Mchango," default would go
 * out as real text nobody chose.
 */
function resolveOccasion(event: MchangoEventSource): string {
  return (event.eventType ?? '').trim();
}

/** Overrides are keyed by field name. A key that is ABSENT means "not touched,
 *  use the event value"; a key that is PRESENT means the tenant decided, and an
 *  empty string there is a decision to leave the slot out. Conflating the two
 *  is what made prefilled text impossible to remove from the form. */
export type MchangoOverrides = Partial<Record<MchangoFieldKey, string | null | undefined>>;

export type MchangoValues = Record<MchangoFieldKey, string>;

/** True when the tenant has made a decision about this slot, cleared or not. */
export function hasMchangoOverride(overrides: MchangoOverrides, key: MchangoFieldKey): boolean {
  const value = overrides[key];
  return value !== undefined && value !== null;
}

/**
 * Resolves one slot: a present override wins outright, and only an absent one
 * falls through to the event.
 *
 * The empty string is returned as-is rather than falling back. A tenant who
 * clears "Airtel Money" is saying "do not mention Airtel", and handing them the
 * event's instructions back is both wrong and the reason prefilled values could
 * never be deleted. Genuine gaps stay as '' rather than becoming a dash: the
 * wire format and the preview each decide their own placeholder, and
 * `missingMchangoFields` needs to be able to tell "empty" from "filled".
 */
function slot(overrides: MchangoOverrides, key: MchangoFieldKey, fallback: string): string {
  const override = overrides[key];
  if (override === undefined || override === null) return fallback;
  return override.trim();
}

/** `slot` for the two date slots, whose overrides arrive as ISO strings from a
 *  <input type="date"> and so are formatted rather than passed through. */
function slotDate(
  overrides: MchangoOverrides,
  key: 'date' | 'deadline',
  fallback: string
): string {
  const override = overrides[key];
  if (override === undefined || override === null) return fallback;
  const trimmed = override.trim();
  return trimmed ? formatSwahiliDate(trimmed) : '';
}

/**
 * Resolve all 13 slots from the event, with any tenant override winning.
 *
 * This is the single place a value is decided. The preview and the send path
 * both call it, so what the tenant saw is what gets sent.
 */
export function resolveMchangoValues(
  event: MchangoEventSource,
  overrides: MchangoOverrides = {}
): MchangoValues {
  const familyName = resolveFamilyName(event);
  const occasion = resolveOccasion(event);
  const primaryName = familyName || (event.name ?? '').trim();

  // var13 is the phone only. Appending the business name here looks fine on the
  // first render, but the editor saves this field straight back into
  // `contactPersonPhone`, so the next load would resolve it to
  // "0754321098 - LittleWed - LittleWed". Keeping the slot equal to the stored
  // column is what makes the editor round-trip.
  const contactPhone = text(event.contactPersonPhone, '');

  const values: MchangoValues = {
    occasion: slot(overrides, 'occasion', occasion),
    greetingName: slot(overrides, 'greetingName', primaryName),
    familyName: slot(overrides, 'familyName', familyName || primaryName),
    venue: slot(overrides, 'venue', event.venue ?? ''),
    eventName: slot(overrides, 'eventName', event.name ?? ''),
    // No family-name fallback here: it would render as
    // "MCHANGO WA Send-Off ya Familia ya Mkumbo". Better to be flagged missing.
    celebrant: slot(overrides, 'celebrant', event.person2 || event.person1 || ''),
    date: slotDate(overrides, 'date', formatSwahiliDate(event.date)),
    address: slot(overrides, 'address', event.address ?? ''),
    deadline: slotDate(overrides, 'deadline', formatSwahiliDate(event.contributionDeadline)),
    mpesa: slot(overrides, 'mpesa', event.mpesaInstructions ?? ''),
    airtel: slot(overrides, 'airtel', event.airtelInstructions ?? ''),
    bank: slot(overrides, 'bank', event.bankInstructions ?? ''),
    contact: slot(overrides, 'contact', contactPhone),
  };

  return values;
}

/**
 * Build the var1..var13 personalisation record for the "Mchango" template.
 * Returns a single-entry array, which is the shape `personalisation` expects.
 */
export function buildMchangoPersonalisation(
  event: MchangoEventSource,
  overrides: MchangoOverrides = {}
): Record<string, string>[] {
  const v = resolveMchangoValues(event, overrides);

  const personalisation: Record<string, string> = {};
  for (const field of MCHANGO_FIELDS) {
    // NexSMS rejects non-strings, and the template only ever receives strings.
    personalisation[field.varKey] = text(v[field.key], DASH);
  }
  return [personalisation];
}

/**
 * The message as the guest will read it, for the on-screen preview.
 *
 * A line whose every slot resolved to empty is dropped whole, and one that kept
 * some slots has its orphaned punctuation tidied. Substituting blanks in place
 * would leave sentences like "itakayofanyika tarehe mahali , ." — exactly the
 * gap the preview exists to reveal, but said as nonsense instead of as a
 * legible message with a visible omission.
 */
export function renderMchangoPreview(values: MchangoValues): string {
  const byVar: Record<string, string> = {};
  for (const field of MCHANGO_FIELDS) byVar[field.varKey] = values[field.key];

  const lines = MCHANGO_PREVIEW_BODY.split('\n').map((line) => {
    let filled = 0;
    let total = 0;

    const text = line.replace(/\{(var\d+)\}/g, (_match, varKey: string) => {
      total += 1;
      const value = (byVar[varKey] ?? '').trim();
      if (!value || value === DASH) return '';
      filled += 1;
      return value;
    });

    // Nothing on this line survived, so the sentence it belonged to is gone.
    if (total > 0 && filled === 0) return null;

    return text
      // Collapse the whitespace an empty slot left behind.
      .replace(/\s+/g, ' ')
      // "mahali , ." -> "mahali."
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/,\s*\./g, '.')
      // A slot that ended the sentence but was empty: "asante ." -> "asante"
      .replace(/\s+\.$/g, '.')
      .trim();
  });

  return lines
    .filter((line): line is string => line !== null)
    .filter((line, index, all) => {
      // Collapse the runs of blank lines left behind by dropped lines, but keep
      // intentional single blank lines between paragraphs.
      if (line !== '') return true;
      return index > 0 && all[index - 1] !== '';
    })
    .join('\n')
    .replace(/^\s+|\s+$/g, '');
}

/** Slots still carrying the placeholder, so the editor can flag them. */
export function missingMchangoFields(values: MchangoValues): MchangoFieldKey[] {
  return MCHANGO_FIELDS.filter((f) => {
    const value = values[f.key].trim();
    return value === '' || value === DASH;
  }).map((f) => f.key);
}

/** NexSMS template name for the approved contribution reminder. */
export const MCHANGO_TEMPLATE_DEFAULT = 'Mchango';

export function getMchangoTemplate(): string {
  return process.env.REMINDER_WHATSAPP_TEMPLATE || MCHANGO_TEMPLATE_DEFAULT;
}
