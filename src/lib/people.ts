import type { Contact } from './types';

/** Apollo seniorities that can own a problem and a budget. */
export const SENIOR = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director'];
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
  return out.slice(0, 3);
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
