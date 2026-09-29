// Eval: does Jev label website snippets with the right signal type?
// Run: TYPESAFE_KEY=... node eval/site-signals-eval.mjs
// 2026-09-29: 29/30 (miss: a third-party model's adoption stat labelled ai_launch).
// Snippets are real (from linear.app, intercom.com, notion.com, vercel.com, gorgias.com on 2026-09-29) plus a few synthetic
// ones for types those sites didn't show. Each lists the acceptable types.
const KEY = process.env.TYPESAFE_KEY;
if (!KEY) throw new Error('Set TYPESAFE_KEY');

// Node 22.18+/23.6+ strips TypeScript types, so the shipped list is imported directly.
const { SITE_SIGNAL_TYPES: TYPES } = await import('../src/lib/site-types.ts');

const CASES = [
  ['Salesforce signs definitive agreement to acquire Fin', 'blog', ['acquisition']],
  ['ZeroEntropy is joining Notion', 'blog', ['acquisition']],
  ["Meet (again) Max Schoening, Notion's new CTO", 'blog', ['leadership']],
  ['Independent audits confirm your data is encrypted, monitored, and protected by enterprise-grade controls. SOC 2 Type II compliant and ISO 27001 certified.', 'security', ['security_compliance']],
  ['ISO 27001, ISO 27701, ISO 27017, ISO 27018', 'security', ['security_compliance']],
  ['The Vercel Bug Bounty Program is now publicly available', 'blog', ['security_compliance']],
  ['SAML and SCIM', 'pricing', ['enterprise_push', 'security_compliance']],
  ['Enterprise discounts may be available via Sales', 'pricing', ['enterprise_push']],
  ['Yes, we offer custom invoicing for Enterprise customers. Contact our sales team to learn more.', 'pricing', ['enterprise_push']],
  ['Announcing Evals and Releases: Evaluate Fin before, during, and after you go live', 'blog', ['ai_launch', 'product_launch']],
  ['Notion 3.7: Agent skills for your whole team', 'changelog', ['ai_launch', 'product_launch']],
  ['Coding sessions: environments, browser use, and updated pricing', 'changelog', ['ai_launch', 'product_launch', 'pricing_change']],
  ['Now Linear writes the code, too', 'blog', ['ai_launch', 'product_launch']],
  ['Rebuilding Notion’s lexical search reindexer', 'blog', ['none']],
  ['Doing the right thing when things go wrong', 'blog', ['none']],
  ['The 9 best tools for your early-stage startup tech stack in 2026', 'blog', ['none']],
  ['Ticket Volume: How to Measure It, Benchmark It, and Reduce It', 'blog', ['none']],
  ['Styling Linear for the future with StyleX', 'blog', ['none']],
  ['Plan and navigate from idea to launch. Align your team with product initiatives, strategic roadmaps, and clear, up-to-date PRDs.', 'home', ['none']],
  ['How Klaviyo shipped 356 internal apps in two weeks on Vercel', 'blog', ['customer_milestone', 'none']],
  ['Jev is the fastest-adopted model in AI Gateway history', 'blog', ['customer_milestone', 'none', 'product_launch']],
  ['Meet Notion’s Board of Directors', 'blog', ['leadership', 'none']],
  // Synthetic, for types the real sites didn't show.
  ['We raised a $50M Series B led by Accel to build the future of support', 'blog', ['funding']],
  ['Hello, London: we are opening our first European office', 'blog', ['expansion']],
  ['Now available in Japan, Korea and Australia', 'home', ['expansion']],
  ['Introducing our native HubSpot integration', 'changelog', ['partnership', 'product_launch']],
  ['Acme and Salesforce announce strategic partnership', 'blog', ['partnership']],
  ['Welcome Jane Doe, our new VP of Customer Experience', 'blog', ['leadership']],
  ['New pricing: simpler plans, starting at $10 per seat', 'pricing', ['pricing_change']],
  ['We just crossed 10,000 customers', 'home', ['customer_milestone']],
];

async function ask(state, questions) {
  const r = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()).answers;
}

const question = (i) => ({
  type: 'choice',
  instructions: `What does the website snippet \`snippets[${i}]\` (from \`company\`'s own site) announce or show about the company? Pick "none" for generic marketing copy, how-to or thought-leadership posts, and engineering write-ups.`,
  criteria: TYPES,
});

let right = 0; const wrong = [];
for (let start = 0; start < CASES.length; start += 10) {
  const batch = CASES.slice(start, start + 10);
  const q = {}; batch.forEach((_, i) => (q[`s_${i}`] = question(i)));
  const a = await ask({ company: { name: 'the company' }, snippets: batch.map(([text, source]) => ({ text, page: source })) }, q);
  batch.forEach(([text, , ok], i) => {
    const got = a[`s_${i}`];
    if (ok.includes(got.choice)) right++;
    else wrong.push(`${got.choice} (${got.probabilities[got.choice].toFixed(2)}) ← "${text.slice(0, 70)}" want ${ok.join('|')}`);
  });
}
console.log(`${right}/${CASES.length}`);
for (const w of wrong) console.log('  ✗', w);
