import {
  MCHANGO_TEMPLATE_BODY,
  buildMchangoPersonalisation,
  missingMchangoFields,
  renderMchangoPreview,
  renderMchangoPreviewRuns,
  resolveMchangoValues,
  type MchangoEventSource,
} from './lib/whatsapp/mchango';

const event: MchangoEventSource = {
  name: 'Send-Off ya Neema na Kelvin',
  eventType: 'Send-Off',
  hostFamily: 'Familia ya Mkumbo',
  person1: 'Neema',
  person2: 'Kelvin',
  venue: 'Garden Paradise',
  address: 'Kigamboni, Dar es Salaam',
  date: new Date('2026-11-25T10:00:00Z'),
  contributionDeadline: new Date('2026-11-20T10:00:00Z'),
  mpesaInstructions: '0762208760 - MAGRETH MKUMBI',
  airtelInstructions: '',
  bankInstructions: '',
  contactPersonPhone: '0754321098',
};

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) {
    failures += 1;
    console.log(`      ${detail}`);
  }
}

const values = resolveMchangoValues(event, {}, 'Neema');
const runs = renderMchangoPreviewRuns(values);
const flat = renderMchangoPreview(values);
const emptyPayments = renderMchangoPreview(resolveMchangoValues(event, { airtel: '', bank: '' }, 'Neema'));
const cleared = resolveMchangoValues(event, { mpesa: '' }, 'Neema');

check(
  'preview bold runs are exactly the wrapped slots',
  JSON.stringify(runs.filter((r) => r.bold).map((r) => r.text.trim())) ===
    JSON.stringify(['Send-Off,', 'Neema,', 'Mkumbo']),
  JSON.stringify(runs.filter((r) => r.bold).map((r) => r.text.trim()))
);
check('preview contains no asterisks', !flat.includes('*'), flat);
check('empty payment slots drop the whole label', !emptyPayments.includes('Namna ya kutuma Mchango:'), emptyPayments);
check(
  'cleared and unfilled slots are flagged missing',
  JSON.stringify(missingMchangoFields(cleared).sort()) === JSON.stringify(['airtel', 'bank', 'mpesa']),
  JSON.stringify(missingMchangoFields(cleared))
);

console.log(failures === 0 ? 'ALL GOOD' : `${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
