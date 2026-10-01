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

const required = [
  '{var1}',
  '{var2}',
  '{var3}',
  '{var4}',
  '{var5}',
  '{var6}',
  '{var7}',
  '{var8}',
  '{var9}',
  '{var10}',
  '{var11}',
  '{var12}',
  '{var13}',
];

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) {
    failures += 1;
    console.log(`      ${detail}`);
  }
}

const positions = required.map((slot) => MCHANGO_TEMPLATE_BODY.indexOf(slot));
check(
  'body holds var1..var13 in order',
  positions.every((p, i) => p > -1 && (i === 0 || p > positions[i - 1])),
  `positions: ${positions.join(',')}`
);

check(
  'body wording matches the approved template',
  MCHANGO_TEMPLATE_BODY ===
    'MCHANGO WA *{var1},* Habari *{var2},* Kwa Upendo na Furaha kubwa, ' +
      'Familia ya *{var3}* wa {var4}, inakuomba uwe sehemu ya safari hii ya maandalizi ya {var5} *{var6}* ' +
      'itanayotarajiwa kufanyika tarehe {var7} {var8}. ' +
      'Tutashukuru kupokea Mchango wako kabla ya tarehe {var9}. ' +
      'Namna ya kutuma Mchango: {var10} {var11} {var12} ' +
      'Kwa maswali na mawasiliano zaidi, wasiliana nasi {var13}. Ahsante!!!',
  MCHANGO_TEMPLATE_BODY
);

const p1 = buildMchangoPersonalisation(event, {}, 'Neema')[0];
const p2 = buildMchangoPersonalisation(event, {}, 'Kelvin')[0];
check(
  'var2 greets the recipient being sent to',
  p1.var2 === 'Neema' && p2.var2 === 'Kelvin',
  `${p1.var2} / ${p2.var2}`
);
check('var13 stays a bare phone number', p1.var13 === '0754321098', p1.var13);
check(
  'all 13 values are strings',
  required.every((slot) => typeof p1[slot.slice(1, -1)] === 'string'),
  JSON.stringify(p1)
);

const values = resolveMchangoValues(event, {}, 'Neema');
const runs = renderMchangoPreviewRuns(values);
const flat = renderMchangoPreview(values);
console.log('\n--- bold runs ---');
runs.forEach((r) => console.log(`${r.bold ? 'BOLD' : '    '} |${r.text}|`));
console.log('\n--- merged preview ---\n' + flat + '\n');

check('preview contains no asterisks', !flat.includes('*'), flat);
check(
  'preview bold runs are exactly the wrapped slots',
  JSON.stringify(runs.filter((r) => r.bold).map((r) => r.text.trim())) ===
    JSON.stringify(['Send-Off,', 'Neema,', 'Familia ya Mkumbo', 'Kelvin']),
  JSON.stringify(runs.filter((r) => r.bold).map((r) => r.text.trim()))
);
check(
  'plain and bold runs keep a space between them',
  !/WA\s*Send-Off/.test(flat) && /WA Send-Off/.test(flat),
  flat
);
check('preview contains the recipient name', flat.includes('Habari Neema,'), flat);

const emptyPayments = renderMchangoPreview(
  resolveMchangoValues(event, { airtel: '', bank: '' }, 'Neema')
);
console.log('--- no payment methods ---\n' + emptyPayments + '\n');
check(
  'empty payment slots drop the whole label',
  !emptyPayments.includes('Namna ya kutuma Mchango:') &&
    !emptyPayments.includes('M-Pesa') &&
    /Tutashukuru[\s\S]*Ahsante!!!/.test(emptyPayments),
  emptyPayments
);

const cleared = resolveMchangoValues(event, { mpesa: '' }, 'Neema');
check('cleared override stays empty', cleared.mpesa === '', cleared.mpesa);
check(
  'cleared and unfilled slots are flagged missing',
  JSON.stringify(missingMchangoFields(cleared).sort()) === JSON.stringify(['airtel', 'bank', 'mpesa']),
  JSON.stringify(missingMchangoFields(cleared))
);

const pinned = resolveMchangoValues(event, { greetingName: 'Mchungu' }, 'Neema');
check('explicit greeting override still wins', pinned.greetingName === 'Mchungu', pinned.greetingName);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
