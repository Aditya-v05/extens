// Eval: does the per-person rank question put people who lead the buyer's function above the ones who work in it?
// Run: TYPESAFE_KEY=... node eval/rank-eval.mjs
// Titles are real Apollo titles (Linear, Ramp; 2026-09-29). Checked as pairs: the first title must outrank the second.
const KEY = process.env.TYPESAFE_KEY;
if (!KEY) throw new Error('Set TYPESAFE_KEY');
const { RANK_VARIANTS } = await import('./rank-variants.mjs');

const seller = {
  sells: 'AI support QA software for SaaS companies: automatically scores every support conversation for quality.',
  typical_buyers: 'VP Customer Experience, Head of Support, COO',
};
const COMPANIES = {
  Linear: ['Customer Experience', 'Customer Experience Leader', 'Customer Experience', 'Chief Operating Officer', 'Customer Success', 'Product Operations Lead', 'Customer Success', 'Product Support Specialist', 'People Operations', 'Revenue & Business Operations'],
  Ramp: ['Head of Customer Operations', 'Customer Experience', 'Customer Experience Manager', 'Head of Customer Success & Strategy Lead', 'CX', 'Director, Customer Success, Scaled and Partnerships', 'Customer Experience', 'Associate Manager, Customer Experience', 'Senior Premier Support Specialist', 'Senior Customer Operations Specialist'],
};
// [company, higher title, lower title]
const PAIRS = [
  ['Linear', 'Customer Experience Leader', 'Customer Experience'],
  ['Linear', 'Customer Experience Leader', 'Customer Success'],
  ['Linear', 'Customer Experience Leader', 'Product Support Specialist'],
  ['Linear', 'Chief Operating Officer', 'Customer Experience'],
  ['Linear', 'Customer Experience', 'People Operations'],
  ['Linear', 'Customer Experience', 'Revenue & Business Operations'],
  ['Ramp', 'Head of Customer Operations', 'Customer Experience'],
  ['Ramp', 'Head of Customer Operations', 'Customer Experience Manager'],
  ['Ramp', 'Customer Experience Manager', 'Customer Experience'],
  ['Ramp', 'Customer Experience Manager', 'CX'],
  ['Ramp', 'Associate Manager, Customer Experience', 'Customer Experience'],
  ['Ramp', 'Head of Customer Operations', 'Senior Premier Support Specialist'],
  ['Ramp', 'Customer Experience Manager', 'Senior Customer Operations Specialist'],
  ['Ramp', 'Head of Customer Operations', 'Head of Customer Success & Strategy Lead'],
];

async function rank(variant, titles, company) {
  const q = {};
  titles.forEach((_, i) => (q[`rank_${i}`] = { type: 'score', instructions: variant(i), criteria: RANK_LEVELS }));
  const r = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state: { seller, company: { name: company }, best_persona: null, people: titles.map((title) => ({ title })) }, questions: q }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const a = (await r.json()).answers;
  return titles.map((_, i) => a[`rank_${i}`].score);
}
const { RANK_LEVELS } = await import('./rank-variants.mjs');

for (const [name, variant] of Object.entries(RANK_VARIANTS)) {
  const scores = {};
  for (const [company, titles] of Object.entries(COMPANIES)) {
    const s = await rank(variant, titles, company);
    scores[company] = Object.fromEntries(titles.map((t, i) => [t, Math.max(scores[company]?.[t] ?? -1, s[i])]));
  }
  let right = 0; const wrong = [];
  for (const [c, hi, lo] of PAIRS) {
    if (scores[c][hi] > scores[c][lo]) right++;
    else wrong.push(`${c}: "${hi}" ${scores[c][hi].toFixed(2)} <= "${lo}" ${scores[c][lo].toFixed(2)}`);
  }
  console.log(`${name}: ${right}/${PAIRS.length}`);
  for (const w of wrong) console.log('   ✗', w);
}
