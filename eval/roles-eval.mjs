// Eval: which wording of the per-role "why now" question best separates relevant from irrelevant roles?
// Run: TYPESAFE_KEY=... node eval/roles-eval.mjs
// Each seller is judged at a neutral company and at one in the seller's own space (where industry can mislead).
// C_buyer_team ships (src/lib/questions.ts): 132/132 on 2026-09-29, batched by 10. A: 125, B: 127, D: 119.
const KEY = process.env.TYPESAFE_KEY;
if (!KEY) throw new Error('Set TYPESAFE_KEY');
const T = true, F = false, B = null; // B = borderline, excluded from scoring

const SELLERS = {
  support_qa: {
    sameIndustry: { name: 'Intercom', description: 'AI-first customer service platform: helpdesk, chatbots and support automation software.', employees: 1200 },
    seller: { sells: 'AI support QA software for SaaS companies: automatically scores support conversations for quality.', typical_buyers: 'VP Customer Experience, Head of Support, COO' },
    labels: {
      'Technical Support Specialist': T, 'Product Support Specialist': T, 'Customer Support Team Lead': T,
      'Support Operations Manager': T, 'Head of Customer Experience': T, 'Support Quality Analyst': T,
      'Customer Support Engineer': T, 'Director of Customer Support': T,
      'Customer Success Manager': B, 'Senior Customer Education Manager': B, 'Implementation Manager': B,
      'Account Executive': F, 'Solutions Engineer': F, 'Forward Deployed Engineer': F, 'Staff Data Engineer': F,
      'Product Designer': F, 'Technical Recruiter': F, 'Deal Desk': F, 'Revenue Operations': F, 'Analytics Engineer': F,
      'Product Marketing Manager': F, 'Staff AI Product Manager': F, 'Principal Program Manager': F,
      'Business Development Representative': F, 'Relationship Manager, Mid Market': F, 'Senior Solutions Architect': F,
      'Senior AI Deployment Consultant': F, 'Backend Engineer': F, 'Financial Analyst': F, 'Account Manager, Enterprise Expansion': F,
    },
  },
  sales_engagement: {
    sameIndustry: { name: 'Gong', description: 'Revenue intelligence platform for sales teams: call recording and deal analytics.', employees: 1300 },
    seller: { sells: 'Sales engagement software: email and call sequences for outbound sales teams.', typical_buyers: 'VP Sales, Head of Sales Development, RevOps' },
    labels: {
      'Account Executive': T, 'Business Development Representative': T, 'Sales Development Representative': T,
      'Sales Development Manager': T, 'Revenue Operations': T, 'Sales Enablement Manager': T, 'Enterprise Account Executive': T,
      'Head of Sales': T,
      'Deal Desk': B, 'Relationship Manager, Mid Market': B, 'Account Manager, Enterprise Expansion': B, 'Solutions Engineer': B,
      'Technical Support Specialist': F, 'Product Support Specialist': F, 'Customer Support Team Lead': F, 'Backend Engineer': F,
      'Product Designer': F, 'Technical Recruiter': F, 'Analytics Engineer': F, 'Staff Data Engineer': F,
      'Staff AI Product Manager': F, 'Financial Analyst': F, 'Support Quality Analyst': F, 'Principal Program Manager': F,
      'Forward Deployed Engineer': F,
    },
  },
  dev_platform: {
    sameIndustry: { name: 'Vercel', description: 'Frontend cloud and developer platform for building and deploying web apps.', employees: 700 },
    seller: { sells: 'CI/CD and developer productivity platform that speeds up builds and deploys.', typical_buyers: 'VP Engineering, Head of Platform, CTO' },
    labels: {
      'Backend Engineer': T, 'Platform Engineer': T, 'Site Reliability Engineer': T, 'DevOps Engineer': T,
      'Staff Software Engineer': T, 'Engineering Manager, Infrastructure': T, 'Mobile Engineer': T,
      'Staff Data Engineer': B, 'Analytics Engineer': B, 'Forward Deployed Engineer': B, 'Solutions Engineer': B,
      'Account Executive': F, 'Technical Support Specialist': F, 'Customer Success Manager': F, 'Product Designer': F,
      'Technical Recruiter': F, 'Deal Desk': F, 'Revenue Operations': F, 'Product Marketing Manager': F, 'Financial Analyst': F,
      'Business Development Representative': F, 'Senior Customer Education Manager': F,
    },
  },
};

const VARIANTS = {
  A_current: (i) => ({ type: 'noul', instructions: `Does the open role \`open_roles[${i}]\` suggest that \`company\` is building up the team or function that the seller's product (\`seller.sells\`) serves or would help?` }),
  B_team_member: (i) => ({
    type: 'noul',
    instructions: `Would the person hired for \`open_roles[${i}]\` work inside the team that uses the seller's product (\`seller.sells\`) day to day?`,
    criteria: {
      true: 'The role is part of the team that would use or own the seller\'s product.',
      false: 'The role is in a different team, even if it sells to, supports, or works alongside that team.',
    },
  }),
  D_role_not_industry: (i) => ({
    type: 'noul',
    instructions: `Judge only the job function of \`open_roles[${i}]\`, not the industry of \`company\`. Is this role in the team or department run by the seller's typical buyers (\`seller.typical_buyers\`), i.e. the people who would use the seller's product (\`seller.sells\`)?`,
    criteria: {
      true: "Yes: this hire joins the team that uses or owns the seller's product.",
      false: "No: this hire is in another function (for example sales, engineering, design, recruiting, finance, marketing or product), even if the company's own product is in the same space as the seller's.",
    },
  }),
  C_buyer_team: (i) => ({
    type: 'noul',
    instructions: `Is \`open_roles[${i}]\` a role in the team or department run by the seller's typical buyers (\`seller.typical_buyers\`), i.e. the people who would use the seller's product (\`seller.sells\`)?`,
    criteria: {
      true: 'Yes: this hire joins the team that uses or owns the seller\'s product.',
      false: 'No: this hire is in another function (for example sales, engineering, design, recruiting, finance or product), unless that function is the one the seller\'s product serves.',
    },
  }),
};

async function ask(state, questions) {
  const r = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()).answers;
}

const neutral = { name: 'Acme', description: 'B2B SaaS company', employees: 400 };
const results = {};
for (const [vName, make] of Object.entries(VARIANTS)) {
  let right = 0, total = 0;
  const mistakes = [];
  for (const [sName, { seller, labels, sameIndustry }] of Object.entries(SELLERS)) {
    for (const company of [neutral, sameIndustry]) {
      const titles = Object.keys(labels);
      // Same as the extension: roles judged in batches of 10 (see ROLE_BATCH in src/lib/questions.ts).
      const a = {};
      for (let start = 0; start < titles.length; start += 10) {
        const batch = titles.slice(start, start + 10);
        const q = {};
        batch.forEach((_, i) => (q[`job_${i}`] = make(i)));
        const ans = await ask({ seller, company, open_roles: batch.map((title) => ({ title })) }, q);
        batch.forEach((_, i) => (a[`job_${start + i}`] = ans[`job_${i}`]));
      }
      titles.forEach((t, i) => {
        const label = labels[t];
        if (label === null) return;
        const p = a[`job_${i}`].noul;
        total++;
        if ((p >= 0.5) === label) right++;
        else mistakes.push(`${label ? 'missed' : 'false +'} ${sName} @ ${company.name}: ${t} (${p.toFixed(2)})`);
      });
    }
  }
  results[vName] = { accuracy: `${right}/${total}`, mistakes };
}
console.log(JSON.stringify(results, null, 2));
