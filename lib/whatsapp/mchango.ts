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
  kind: 'text' | 'date' | 'select' | 'tel' | 'guest';
  /** Event column that seeds the default, if any. */
  fromEvent?: string;
  options?: readonly string[];
  /** The slot is filled per recipient from the guest list rather than once for
   *  the whole broadcast. A guest always sees their own name here, so typing a
   *  fixed value only changes the preview. */
  perGuest?: boolean;
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
    label: 'Guest name',
    labelSw: 'Jina la mgeni',
    hint: 'Pick who to preview. Every guest actually receives their own name here.',
    placeholder: 'Select a guest from the list',
    group: 'occasion',
    kind: 'guest',
    perGuest: true,
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
 * The approved NexSMS body, verbatim.
 *
 * The asterisks are WhatsApp bold markers and are part of the wire format, so
 * they stay in this string exactly as the provider holds them. `renderMchangoPreview`
 * turns them into real bold runs for the on-screen preview instead of showing the
 * guest raw `*` characters.
 */
export const MCHANGO_TEMPLATE_BODY =
  'MCHANGO WA *{var1},* Habari *{var2},* Kwa Upendo na Furaha kubwa, ' +
  'Familia ya *{var3}* wa {var4}, inakuomba uwe sehemu ya safari hii ya maandalizi ya {var5} *{var6}* ' +
  'itanayotarajiwa kufanyika tarehe {var7} {var8}. ' +
  'Tutashukuru kupokea Mchango wako kabla ya tarehe {var9}. ' +
  'Namna ya kutuma Mchango: {var10} {var11} {var12} ' +
  'Kwa maswali na mawasiliano zaidi, wasiliana nasi {var13}. Ahsante!!!';

/** Kept as an alias so existing imports of the preview body keep working. */
export const MCHANGO_PREVIEW_BODY = MCHANGO_TEMPLATE_BODY;

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

/** "Mkumbo" — the family name on its own. */
function resolveFamilyName(event: MchangoEventSource): string {
  const hostFamily = (event.hostFamily ?? '').trim();
  const parts = [event.person1, event.person2].map((p) => (p ?? '').trim()).filter(Boolean);
  const derived = parts.length === 2 ? `${parts[0]} & ${parts[1]}` : (parts[0] ?? '');

  const family = hostFamily || derived;
  if (!family) return '';
  // The approved body reads "Familia ya {var3}", so the lead-in is already in
  // the fixed text and the slot must carry only the name. Tenants type either
  // form, so a typed "Familia ya" is stripped rather than printed as
  // "Familia ya Familia ya Mkumbo". A value that is nothing but the lead-in is
  // left alone so the tenant can see what they entered and fix it.
  const stripped = family.replace(/^familia\s+ya\s+/i, '').trim();
  return stripped || family;
}

/**
 * var6 is the second name, and it is left empty whenever the event's own name
 * already says it.
 *
 * Event names are usually "Send-Off ya Neema na Kelvin", so defaulting var6 to
 * a person prints the name twice — "…maandalizi ya Send-Off ya Neema na Kelvin
 * Kelvin". Repeating a name is worse than omitting it, and an empty slot is
 * flagged in the editor for the tenant to confirm or clear.
 */
function resolveCelebrant(event: MchangoEventSource): string {
  const candidate = (event.person2 || event.person1 || '').trim();
  if (!candidate) return '';
  const eventName = (event.name ?? '').trim();
  if (eventName && eventName.toLowerCase().includes(candidate.toLowerCase())) return '';
  return candidate;
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
 *
 * Interior whitespace is preserved and only the ends are trimmed. Trimming the
 * whole string on every render made the space key unusable in these boxes: the
 * controlled input's value came back trimmed the instant a space was typed, so
 * React reset the caret and the space never appeared — and "Garden Paradise"
 * came out as "GardenParadise". Trimming the ends is still wanted, since a stray
 * leading or trailing space would push a dash or a comma away from its word in
 * the rendered message.
 */
function slot(overrides: MchangoOverrides, key: MchangoFieldKey, fallback: string): string {
  const override = overrides[key];
  if (override === undefined || override === null) return fallback;
  return trimEnds(override);
}

/**
 * Trims the ends of a string but leaves the inside alone.
 *
 * Plain `trim()` also strips interior spaces at both ends of every word run when
 * a value is re-normalised, which is what silently joined words together. The
 * preview and the wire payload both need the ends tidy; the middle must be
 * exactly what was typed.
 */
function trimEnds(value: string): string {
  return value.replace(/^\s+/, '').replace(/\s+$/, '');
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
 *
 * `guestName` is the recipient. var2 is the only per-guest slot — it greets each
 * guest by their own name — so the send path passes the guest being sent to and
 * gets a payload that is right for that recipient. The editor passes the guest
 * picked for the preview, so the preview shows a real recipient too.
 */
export function resolveMchangoValues(
  event: MchangoEventSource,
  overrides: MchangoOverrides = {},
  guestName?: string
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
    greetingName: slot(overrides, 'greetingName', guestName || primaryName),
    familyName: slot(overrides, 'familyName', familyName || primaryName),
    venue: slot(overrides, 'venue', event.venue ?? ''),
    eventName: slot(overrides, 'eventName', event.name ?? ''),
    // No family-name fallback here: it would render as
    // "MCHANGO WA Send-Off ya Familia ya Mkumbo". Better to be flagged missing.
    celebrant: slot(overrides, 'celebrant', resolveCelebrant(event)),
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
 *
 * `guestName` is the recipient this payload is for. var2 is the only per-guest
 * slot, so the send path builds one payload per guest rather than one for the
 * whole broadcast — otherwise every guest would be greeted by name with someone
 * else's name. An explicit `greetingName` override still wins, which is how the
 * editor pins the preview to one guest.
 */
/**
 * NexSMS answers HTTP 422 for the whole request when any entry in the
 * personalisation array is an empty string:
 *
 *   "There is one or more empty value in the personalisation array."
 *
 * The rejection is not per-recipient — one unfilled slot fails the entire
 * broadcast, so every one of the 13 values must always be a non-empty string.
 * A slot with nothing to say is sent as an em dash, which is also what keeps the
 * sentence legible instead of leaving "…maandalizi ya Send-Off ya Neema na
 * Kelvin itanayotarajiwa" with a hole where {var6} belongs.
 *
 * Do not reintroduce a "blank when empty" exception here: two slots look safely
 * omittable but taking that shortcut is precisely what produced the 422.
 */
export function buildMchangoPersonalisation(
  event: MchangoEventSource,
  overrides: MchangoOverrides = {},
  guestName?: string
): Record<string, string>[] {
  const v = resolveMchangoValues(event, overrides, guestName);

  const personalisation: Record<string, string> = {};
  for (const field of MCHANGO_FIELDS) {
    const value = text(v[field.key], DASH);
    // Last line of defence. `text` already substitutes the dash, but a value
    // made only of spaces survives it, and a whitespace-only entry is rejected
    // exactly like an empty one.
    personalisation[field.varKey] = value.trim() === '' ? DASH : value;
  }
  return [personalisation];
}

/** A run of preview text, `bold` true for the parts the asterisks wrap. */
export interface MchangoPreviewRun {
  text: string;
  bold: boolean;
}

/** Reads one `{varN}` and returns its value, or '' when the slot is unfilled. */
function slotText(byVar: Record<string, string>, varKey: string): string {
  const value = (byVar[varKey] ?? '').trim();
  return !value || value === DASH ? '' : value;
}

/** Tidies the gaps and orphaned punctuation an empty slot leaves behind.
 *
 *  Leading and trailing whitespace is deliberately kept: it is the only space
 *  between two runs, and a bold run that follows plain text has to stay a word
 *  away from it ("MCHANGO WA" + bold "Send-Off," must not read
 *  "MCHANGO WASend-Off,"). */
function tidyPreview(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    // "familia ya  wa" -> "familia ya wa"
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/,\s*\./g, '.');
}

/**
 * The message as the guest will read it, split into plain and bold runs.
 *
 * The wire body keeps WhatsApp's `*…*` markers, so the preview has to render
 * them rather than show them — otherwise the tenant reads a message littered
 * with asterisks that their guest will never see. A slot that resolves to empty
 * is dropped with the asterisks that wrapped it, so an unfilled greeting leaves
 * no `**` behind.
 *
 * Runs concatenate directly rather than being joined with a separator, so the
 * spaces between them come from the body itself.
 */
export function renderMchangoPreviewRuns(values: MchangoValues): MchangoPreviewRun[] {
  const byVar: Record<string, string> = {};
  for (const field of MCHANGO_FIELDS) byVar[field.varKey] = values[field.key];

  const runs: MchangoPreviewRun[] = [];

  // Split on the asterisk pairs first so each segment knows its own weight, then
  // substitute the slots inside it.
  const segments = MCHANGO_TEMPLATE_BODY.split(/(\*[^*]*\*)/g);
  for (const segment of segments) {
    if (segment === '') continue;

    const isBold = segment.length > 2 && segment.startsWith('*') && segment.endsWith('*');
    const inner = isBold ? segment.slice(1, -1) : segment;
    const filled = inner.replace(/\{(var\d+)\}/g, (_m, varKey: string) => slotText(byVar, varKey));

    if (isBold) {
      // The whole bold run was empty; drop it rather than leave bare asterisks.
      if (!filled.trim()) continue;
    }

    const tidy = tidyPreview(filled);
    if (!tidy.trim()) continue;

    const previous = runs[runs.length - 1];
    if (previous && previous.bold === isBold) {
      // Glue the two runs together: the space between them was in the body
      // segment that just got filled. Concatenating means we do not add an
      // extra space when a slot empties.
      previous.text += tidy;
    } else {
      runs.push({ text: tidy, bold: isBold });
    }
  }

  if (runs.length === 0) return runs;

  // Dropping a run leaves the spaces that surrounded it touching, so "…na Kelvin "
  // and " itanayotarajiwa…" become a double space. Collapse again now that the
  // runs are final, then trim only the outer edges; the whitespace in between is
  // the body's.
  for (const run of runs) run.text = run.text.replace(/ {2,}/g, ' ');
  runs[0].text = runs[0].text.replace(/^\s+/, '');
  runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');

  return runs.filter((run) => run.text.length > 0);
}

/**
 * The message as the guest will read it, as one string.
 *
 * A run whose every slot resolved to empty is dropped, and one that kept some
 * slots has its orphaned punctuation tidied. Substituting blanks in place would
 * leave sentences like "itakayofanyika tarehe mahali , ." — exactly the gap the
 * preview exists to reveal, but said as nonsense instead of as a legible message
 * with a visible omission.
 */
export function renderMchangoPreview(values: MchangoValues): string {
  const runs = renderMchangoPreviewRuns(values);
  const merged = runs.map((run) => run.text).join('');

  // With no payment method filled the label would sit alone against a full stop,
  // so the sentence goes with it. The closing clause is the next fixed label in
  // the approved body, which is what makes this unambiguous.
  return merged
    .replace(/\s*Namna ya kutuma Mchango:\s*(?=Kwa maswali)/, ' ')
    .replace(/\s*Familia ya\s+wa\s+/, ' ')
    .trim();
}

/**
 * Slots the editor should flag as a gap.
 *
 * Now that every slot is sent as a dash rather than an empty string, an unfilled
 * slot really is visible to the guest, so all of them are flagged — including
 * var2, which the send fills per guest whatever the preview shows.
 */
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
