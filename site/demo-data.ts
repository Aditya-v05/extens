import { combineFit, jevCheck } from '@/lib/mapping';
import type { Contact, LookupResult } from '@/lib/types';

// A fictional company for the landing page. `.example` is reserved, so it can't be a real business.
const DOMAIN = 'acme.example';

const person = (id: string, first: string, last: string, title: string, rank: number, hasEmail = true): Contact => ({
  apolloId: id, firstName: first, lastName: null, lastNameObfuscated: `${last[0]}***${last.slice(-1)}`, title, hasEmail, rank,
});

const contacts: Contact[] = [
  person('p1', 'Ingrid', 'Holm', 'VP Customer Experience', 92),
  person('p2', 'Jonas', 'Berg', 'Head of Support', 88),
  person('p3', 'Priya', 'Nair', 'Support Operations Manager', 71),
  person('p4', 'Tom', 'Okafor', 'Director, Customer Success', 64),
  person('p5', 'Lea', 'Martin', 'COO', 60),
  person('p6', 'Sam', 'Reyes', 'Support Team Lead', 55, false),
];

// Scored by the extension's own code: 4 requirements met, overall judgment 78.
const fit = combineFit(
  [
    { label: '50–500 employees', source: 'rule', pass: true, state: 'met', credit: 1, detail: '240 employees' },
    { label: 'Based in United States', source: 'rule', pass: true, state: 'met', credit: 1, detail: 'United States' },
    jevCheck('B2B SaaS', 0.95),
    jevCheck('Large customer support team', 0.81),
  ],
  78,
  0.7,
);

export const acme: LookupResult = {
  domain: DOMAIN,
  fetchedAt: Date.now(),
  company: {
    apolloId: 'acme', name: 'Acme', domain: DOMAIN, logo: null, industry: 'computer software', headcount: 240,
    country: 'United States', city: null, fundingStage: 'Series B', totalFunding: '$58M', foundedYear: 2018,
    description: null, keywords: [], linkedin: null,
  },
  fit,
  persona: { chosen: 'Head of Support', confidence: 0.81, distribution: { 'Head of Support': 0.81 } },
  contacts,
  whyNow: {
    timing: 74,
    jobsStatus: 'ok',
    siteStatus: 'ok',
    signals: [
      {
        kind: 'hiring', label: 'Hiring 4 relevant roles', relevance: 0.86,
        detail: 'Support Team Lead, Support Quality Analyst, Customer Support Engineer +1 more',
        evidence: [{ label: 'Support Team Lead', url: '#' }, { label: 'Support Quality Analyst', url: '#' }, { label: 'Customer Support Engineer', url: '#' }, { label: 'Support Operations Analyst', url: '#' }],
      },
      {
        kind: 'site', siteType: 'enterprise_push', label: 'Moving upmarket', relevance: 0.71,
        detail: 'SSO, SCIM and audit logs on the new Enterprise plan',
        evidence: [{ label: 'SSO, SCIM and audit logs on the new Enterprise plan', url: `https://${DOMAIN}/pricing` }],
      },
      { kind: 'headcount_growth', label: 'Headcount +18% in 6 months', detail: '+31% in 12 months', relevance: 0.62, evidence: [{ label: 'Apollo headcount data' }] },
      { kind: 'funding', label: 'Raised $40M Series B', detail: 'Aug 2026, 1 month ago', relevance: 0.48, evidence: [{ label: 'Announcement', url: '#' }] },
    ],
  },
};

export const acmeRevealed: LookupResult = {
  ...acme,
  contacts: contacts.map((c) =>
    c.apolloId === 'p1' ? { ...c, lastName: 'Holm', email: 'ingrid.holm@acme.example', emailStatus: 'verified', revealedAt: Date.now() } : c,
  ),
};
