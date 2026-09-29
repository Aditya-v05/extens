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
      sig('hiring', 'Hiring 3 relevant roles', 'Product Support Specialist, Customer Success Manager, Customer Success Manager, Growth', 0.78, [{ label: 'Product Support Specialist', url: 'https://linear.app/careers/1' }]),
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
  'gorgias.com': {
    domain: 'gorgias.com', fetchedAt: now - 1 * DAY, company: company('Gorgias', 'gorgias.com', 'computer software', 420, 'Series C', null),
    fit: { score: 82, confidence: 0.7, checks: checks(true, true, true, true) }, persona: { chosen: 'VP Customer Experience', confidence: 0.8, distribution: {} },
    contacts: [contact('g1', 'Maya', 'Chen', 'VP Customer Experience', 91, 'maya@gorgias.com'), contact('g2', 'Tom', 'Reyes', 'Head of Support', 88)],
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
export const accountMeta = {
  'gorgias.com': { status: 'contacted', note: 'Emailed Maya on Monday; follow up Thursday.', updatedAt: now },
  'intercom.com': { status: 'not_fit', note: '', updatedAt: now },
};
