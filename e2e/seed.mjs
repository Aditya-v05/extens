// Sample data for e2e/smoke.mjs, shaped like real lookups (from live runs on 2026-09-29).
const DAY = 86400000, now = Date.now();
const contact = (id, first, last, title, rank, email) => ({ apolloId: id, firstName: first, lastName: email ? last : null, lastNameObfuscated: `${last[0]}***${last.slice(-1)}`, title, hasEmail: true, rank, ...(email ? { email, emailStatus: 'verified', revealedAt: now } : {}) });
const company = (name, domain, industry, headcount, stage, logo) => ({ apolloId: domain, name, domain, logo, industry, headcount, country: 'United States', city: null, fundingStage: stage, totalFunding: null, foundedYear: null, description: null, keywords: [], linkedin: `https://www.linkedin.com/company/${name.toLowerCase()}` });
const checks = (a, b, c, d) => [
  { label: '50–500 employees', source: 'rule', pass: a, detail: '' },
  { label: 'Based in United States', source: 'rule', pass: b, detail: 'United States' },
  { label: 'Series A–C SaaS companies', source: 'jev', pass: c, p: c ? 0.94 : 0.1 },
  { label: 'large customer support teams', source: 'jev', pass: d, p: d ? 0.73 : 0.27 },
];
const sig = (kind, label, detail, relevance, evidence = [], siteType) => ({ kind, label, detail, relevance, evidence, ...(siteType ? { siteType } : {}) });
export const results = {
  'linear.app': {
    domain: 'linear.app', fetchedAt: now - 2 * 3600e3, company: company('Linear', 'linear.app', 'information technology & services', 180, 'Series C', null),
    fit: { score: 35, confidence: 0.4, checks: checks(true, true, true, false) }, persona: { chosen: 'Head of Support', confidence: 0.6, distribution: {} },
    contacts: [contact('l1', 'Erin', 'Frey', 'Customer Experience', 72), contact('l2', 'Cristina', 'Cordova', 'Chief Operating Officer', 56, 'cr@linear.app')],
    whyNow: { timing: 66, jobsStatus: 'ok', siteStatus: 'ok', signals: [
      sig('hiring', 'Hiring 3 relevant roles', 'Product Support Specialist, Customer Success Manager, Customer Success Manager, Growth', 0.78, [
        { label: 'Product Support Specialist', url: 'https://linear.app/careers/1' },
        { label: 'Customer Success Manager', url: 'https://linear.app/careers/2' },
        { label: 'Customer Success Manager, Growth', url: 'https://linear.app/careers/3' },
      ]),
      sig('headcount_growth', 'Headcount +21% in 6 months', '+42% in 12 months', 0.55, [{ label: 'Apollo headcount data' }]),
      sig('site', 'Security & compliance', 'SOC 2 compliance', 0.42, [{ label: 'SOC 2 compliance', url: 'https://linear.app/security' }, { label: 'ISO 27001 certified', url: 'https://linear.app/security' }], 'security_compliance'),
    ] },
  },
  'intercom.com': {
    domain: 'intercom.com', fetchedAt: now - 20 * DAY, company: company('Intercom', 'intercom.com', 'information technology & services', 1200, 'Merger / Acquisition', null),
    fit: { score: 55, confidence: 0.1, checks: checks(false, true, false, true) }, persona: { chosen: 'Head of Support', confidence: 0.69, distribution: {} },
    contacts: [contact('i1', 'Pedro', 'Alves', 'Chief Operating Officer', 49)],
    whyNow: { timing: 50, jobsStatus: 'ok', siteStatus: 'ok', signals: [
      sig('hiring', 'Hiring 5 relevant roles', 'Technical Support Specialist, Technical Support Engineer, Senior Customer Success Manager +2 more', 0.74),
      sig('site', 'Shipping AI', 'Announcing Evals and Releases: Evaluate Fin before, during, and after you go live', 0.57, [{ label: 'Announcing Evals and Releases: Evaluate Fin before, during, and after you go live', url: 'https://www.intercom.com/blog/evals', date: '2026-08-12' }], 'ai_launch'),
      sig('site', 'M&A news', 'Salesforce signs definitive agreement to acquire Fin', 0.27, [{ label: 'Salesforce signs definitive agreement to acquire Fin', url: 'https://www.intercom.com/blog/salesforce', date: '2026-06-14' }], 'acquisition'),
    ] },
  },
  // Matches the real gorgias.com lookup from 2026-09-29 (520 employees is a near miss on 50–500).
  'gorgias.com': {
    domain: 'gorgias.com', fetchedAt: now - 1 * DAY, company: company('Gorgias', 'gorgias.com', 'information technology & services', 520, 'Series C', null),
    fit: { score: 69, requirements: 74, overall: 53, confidence: 0.4, checks: [
      { label: '50–500 employees', source: 'rule', pass: false, state: 'near', credit: 0.5, detail: '520, just over' },
      { label: 'Based in United States', source: 'rule', pass: true, state: 'met', credit: 1, detail: 'United States' },
      { label: 'Series A–C SaaS companies', source: 'jev', pass: true, state: 'met', credit: 0.96, p: 0.96 },
      { label: 'large customer support teams', source: 'jev', pass: true, state: 'unsure', credit: 0.5, p: 0.5 },
    ] }, persona: { chosen: 'Head of Support', confidence: 0.72, distribution: { 'Head of Support': 0.72 } },
    // Two near-tied best contacts (91, 88) and six more: the panel should feature both and tuck the rest away.
    contacts: [
      contact('g1', 'Maya', 'Chen', 'VP Customer Experience', 91, 'maya@gorgias.com'), contact('g2', 'Tom', 'Reyes', 'Head of Support', 88),
      contact('g3', 'Hamza', 'Hadi', 'Customer Service Support Manager', 74), contact('g4', 'Funmilayo', 'Okafor', 'Customer Experience Manager', 71),
      contact('g5', 'Igor', 'Petrov', 'COO', 63), contact('g6', 'Dan', 'Wells', 'Chief Operating Officer', 60),
      contact('g7', 'Nerses', 'Avetisyan', 'CX Enablement and Content Management', 52),
      { ...contact('g8', 'Kimberly', 'Moss', 'Customer Service Support Manager', 49), hasEmail: false },
    ],
    whyNow: { timing: 45, jobsStatus: 'ok', siteStatus: 'unavailable', signals: [sig('hiring', 'Hiring 6 relevant roles', 'Senior Customer Success Manager - Enterprise +5 more', 0.64)] },
  },
  'notion.com': {
    domain: 'notion.com', fetchedAt: now - 3 * 3600e3, company: company('Notion', 'notion.com', 'computer software', 3000, 'Series C', null),
    fit: { score: 28, confidence: 0.5, checks: checks(false, true, false, false) }, persona: null, contacts: [],
    whyNow: { timing: 35, jobsStatus: 'ok', siteStatus: 'ok', signals: [sig('site', 'Leadership change', "Meet (again) Max Schoening, Notion's new CTO", 0.24, [], 'leadership')] },
  },
};
export const saved = {
  'linear.app': { ...results['linear.app'], savedAt: now - 2 * DAY },
  'intercom.com': { ...results['intercom.com'], savedAt: now - 20 * DAY },
  'gorgias.com': { ...results['gorgias.com'], savedAt: now - 1 * DAY },
};
export const profile = {
  answers: { sells: 'AI support QA software for SaaS companies.', icp: 'Series A–C SaaS companies, 50–500 employees, based in the US, with large customer support teams.', buyers: 'VP Customer Experience, Head of Support, COO' },
  rules: { headcount: { min: 50, max: 500 }, countries: ['United States'], checks: ['Series A–C SaaS companies', 'large customer support teams'], personas: ['VP Customer Experience', 'Head of Support', 'COO'] },
  updatedAt: now,
};

// A Discover search as stored after one page (real lookalikes of Gorgias from 2026-09-29).
// Key = seeds Linear + Gorgias (Intercom is "Not a fit") with the profile's rules; see searchKey().
export const discover = {
  key: JSON.stringify([['gorgias.com', 'linear.app'], [50, 500], ['United States']]),
  seeds: [{ apolloId: 'linear.app', name: 'Linear', domain: 'linear.app' }, { apolloId: 'gorgias.com', name: 'Gorgias', domain: 'gorgias.com' }],
  filtersLabel: '50–500 employees, United States', fetchedAt: now - 3600e3, page: 1, totalEntries: 403,
  candidates: [
    { apolloId: 'hs', name: 'Help Scout', domain: 'helpscout.com', logo: null, foundedYear: 2011, revenue: '35M', growth12: -0.037, linkedin: null },
    { apolloId: 'ku', name: 'Kustomer', domain: 'kustomer.com', logo: null, foundedYear: 2015, revenue: '53M', growth12: 0.123, linkedin: null },
    { apolloId: 'ne', name: 'Netomi', domain: 'netomi.com', logo: null, foundedYear: 2016, revenue: '46.6M', growth12: 0.216, linkedin: null },
  ],
};

export const accountMeta = {
  'gorgias.com': { status: 'contacted', note: 'Emailed Maya on Monday; follow up Thursday.', updatedAt: now },
  'intercom.com': { status: 'not_fit', note: '', updatedAt: now },
};
