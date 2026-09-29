import { priority, type AccountMeta } from './accounts';
import { upgradeResult } from './mapping';
import type { LookupResult, Rules } from './types';

/** A lookalike company from Apollo's organization search (which returns no industry or headcount). */
export interface Candidate {
  apolloId: string;
  name: string;
  domain: string;
  logo: string | null;
  foundedYear: number | null;
  revenue: string | null;
  /** 12-month headcount growth as a fraction, e.g. 0.18. */
  growth12: number | null;
  linkedin: string | null;
}

export interface DiscoverSeed {
  apolloId: string;
  name: string;
  domain: string;
}

/** One Discover search (and the pages loaded so far), cached so revisits cost nothing. */
export interface DiscoverResult {
  /** Seeds + filters; a different key means a different search. */
  key: string;
  seeds: DiscoverSeed[];
  filtersLabel: string;
  fetchedAt: number;
  page: number;
  totalEntries: number;
  candidates: Candidate[];
}

/** Apollo accepts at most 5 lookalike seeds. */
export const MAX_SEEDS = 5;
/** Credits are per page (up to 100), so a larger page is better value; 50 keeps the list readable. */
export const DISCOVER_PAGE_SIZE = 50;
const HEADCOUNT_CEILING = 1_000_000;

export interface LookalikeQuery {
  lookalike_organization_ids: string[];
  organization_num_employees_ranges?: string[];
  organization_locations?: string[];
  not_organization_websites_list?: string[];
  page: number;
  per_page: number;
}

/** The saved accounts to find lookalikes of: best priority first, never ones marked "Not a fit". */
export function pickSeeds(saved: Record<string, LookupResult & { savedAt: number }>, meta: Record<string, AccountMeta>): DiscoverSeed[] {
  return Object.values(saved)
    .filter((a) => a.company.apolloId && meta[a.domain]?.status !== 'not_fit')
    .map((a) => ({ a, p: priority(upgradeResult(a)) ?? -1 }))
    .sort((x, y) => y.p - x.p)
    .slice(0, MAX_SEEDS)
    .map(({ a }) => ({ apolloId: a.company.apolloId, name: a.company.name, domain: a.domain }));
}

/** Seeds + the user's exact ICP rules become Apollo filters, so every result already passes them. */
export function buildLookalikeQuery(rules: Rules, seeds: DiscoverSeed[], exclude: string[], page: number): LookalikeQuery {
  const q: LookalikeQuery = {
    lookalike_organization_ids: seeds.slice(0, MAX_SEEDS).map((s) => s.apolloId),
    page,
    per_page: DISCOVER_PAGE_SIZE,
  };
  const h = rules.headcount;
  if (h && (h.min !== null || h.max !== null)) {
    q.organization_num_employees_ranges = [`${h.min ?? 1},${h.max ?? HEADCOUNT_CEILING}`];
  }
  if (rules.countries.length) q.organization_locations = rules.countries.map((c) => c.toLowerCase());
  const ex = [...new Set(exclude.map((d) => d.toLowerCase()))];
  if (ex.length) q.not_organization_websites_list = ex;
  return q;
}

export function filtersLabel(rules: Rules): string {
  const parts: string[] = [];
  const h = rules.headcount;
  if (h && h.min !== null && h.max !== null) parts.push(`${h.min.toLocaleString('en-US')}–${h.max.toLocaleString('en-US')} employees`);
  else if (h?.min != null) parts.push(`${h.min.toLocaleString('en-US')}+ employees`);
  else if (h?.max != null) parts.push(`up to ${h.max.toLocaleString('en-US')} employees`);
  if (rules.countries.length) parts.push(rules.countries.length > 3 ? `${rules.countries.slice(0, 3).join(', ')} and more` : rules.countries.join(', '));
  return parts.join(', ');
}

/**
 * Identity of a search. Built from plain arrays, never from objects as stored: chrome.storage hands
 * objects back with their keys sorted ({max, min}), which would make the same rules look different.
 */
export function searchKey(rules: Rules, seeds: DiscoverSeed[]): string {
  const h = rules.headcount;
  return JSON.stringify([seeds.map((s) => s.apolloId).sort(), h ? [h.min, h.max] : null, [...rules.countries].sort()]);
}

export function mapCandidate(o: any): Candidate | null {
  const domain = (o?.primary_domain ?? o?.domain ?? '').toLowerCase();
  // Companies already in the user's Apollo account list come back as "accounts" keyed by organization_id.
  const id = o?.organization_id ?? o?.id;
  if (!id || !domain) return null;
  return {
    apolloId: id,
    name: o.name ?? domain,
    domain,
    logo: o.logo_url ?? null,
    foundedYear: typeof o.founded_year === 'number' ? o.founded_year : null,
    revenue: o.organization_revenue_printed ?? null,
    growth12: typeof o.organization_headcount_twelve_month_growth === 'number' ? o.organization_headcount_twelve_month_growth : null,
    linkedin: o.linkedin_url ?? null,
  };
}

/** Append a page, dropping duplicates and anything the user has since saved, viewed or dismissed. */
export function mergeCandidates(existing: Candidate[], incoming: Candidate[], exclude: Set<string>): Candidate[] {
  const seen = new Set(existing.map((c) => c.domain));
  const out = existing.filter((c) => !exclude.has(c.domain));
  for (const c of incoming) {
    if (seen.has(c.domain) || exclude.has(c.domain)) continue;
    seen.add(c.domain);
    out.push(c);
  }
  return out;
}
