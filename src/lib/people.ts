import type { Contact, Rules } from './types';

/** Apollo's seniority values, most senior first, with how Settings shows them. */
export const SENIORITY_OPTIONS: [string, string][] = [
  ['owner', 'Owner'], ['founder', 'Founder'], ['c_suite', 'C-level'], ['partner', 'Partner'], ['vp', 'VP'],
  ['head', 'Head'], ['director', 'Director'], ['manager', 'Manager'], ['senior', 'Senior'], ['entry', 'Entry'],
];

/** Default: the levels that can own a problem and a budget. */
export const SENIOR = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director'];

export interface PeopleFilters {
  titles: string[];
  seniorities: string[];
  keywords: string[];
  excludeTitles: string[];
}

/** The user's "Who to look for" settings, with defaults for anything not set (e.g. older profiles). */
export function peopleFilters(rules: Rules): PeopleFilters {
  return {
    titles: rules.personas,
    seniorities: rules.seniorities ?? SENIOR,
    keywords: rules.keywords ?? functionKeywords(rules.personas),
    excludeTitles: rules.excludeTitles ?? [],
  };
}

/** Drop people whose title contains an excluded word (whole word, any case). */
export function excludeByTitle(people: Contact[], excluded: string[]): Contact[] {
  const words = excluded.map((w) => w.trim().toLowerCase()).filter(Boolean);
  if (!words.length) return people;
  const res = words.map((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i'));
  return people.filter((p) => !res.some((re) => re.test(p.title ?? '')));
}
/** Enough to find the real owner without flooding Jev (ranked in batches of 10). */
export const MAX_PEOPLE = 25;

const RANK_WORDS = new Set([
  'vp', 'vice', 'president', 'svp', 'evp', 'avp', 'head', 'of', 'director', 'chief', 'officer', 'senior', 'sr',
  'lead', 'manager', 'global', 'the', 'and', '&', 'principal', 'executive', 'group', 'team', 'leader', 'dir',
]);

/**
 * Single function words from the persona titles: "VP Customer Experience", "Head of Support", "COO"
 * → "customer", "experience", "support". Each is searched among senior people. Single words, because
 * at Ramp (2026-09-29) "customer" found the Head of Customer Operations and four Customer Success
 * heads, while the phrase "customer experience" and the exact titles found no one senior.
 * Acronyms like "COO" have no function words and are left to title search.
 */
export function functionKeywords(personas: string[]): string[] {
  const out: string[] = [];
  for (const p of personas) {
    for (const w of p.toLowerCase().replace(/[,/()-]/g, ' ').split(/\s+/)) {
      if (w.length > 3 && !RANK_WORDS.has(w) && !out.includes(w)) out.push(w);
    }
  }
  return out.slice(0, 5);
}

/** Merge search results in priority order, without duplicates, up to a cap. */
export function mergePeople(lists: Contact[][], cap = MAX_PEOPLE): Contact[] {
  const seen = new Set<string>();
  const out: Contact[] = [];
  for (const list of lists) {
    for (const c of list) {
      if (seen.has(c.apolloId)) continue;
      seen.add(c.apolloId);
      out.push(c);
      if (out.length >= cap) return out;
    }
  }
  return out;
}
