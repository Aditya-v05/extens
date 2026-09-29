import type { Contact, LookupResult } from './types';

export type AccountStatus = 'new' | 'contacted' | 'replied' | 'not_fit';

export const STATUS_LABELS: Record<AccountStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  not_fit: 'Not a fit',
};

/** What the user adds to a saved account; kept apart from the lookup snapshot so refreshes don't wipe it. */
export interface AccountMeta {
  status: AccountStatus;
  note: string;
  updatedAt: number;
}

export type SavedAccount = LookupResult & { savedAt: number };

export interface AccountRow {
  domain: string;
  result: LookupResult;
  saved: boolean;
  savedAt: number | null;
  meta: AccountMeta;
  priority: number | null;
  stale: boolean;
}

export const EMPTY_META: AccountMeta = { status: 'new', note: '', updatedAt: 0 };

const DAY = 24 * 60 * 60 * 1000;
export const STALE_AFTER_DAYS = 14;

/**
 * One number to rank by: mostly fit (is this a customer at all?), partly timing (why now?).
 * No timing data counts as 0 timing rather than hiding the account.
 */
export function priority(r: LookupResult): number | null {
  if (!r.fit) return null;
  return Math.round(0.6 * r.fit.score + 0.4 * (r.whyNow?.timing ?? 0));
}

export const isStale = (r: LookupResult, now = Date.now()) => now - r.fetchedAt > STALE_AFTER_DAYS * DAY;

/** Most relevant why-now signal worth showing (relevance ≥ 0.5), if any. */
export const topSignal = (r: LookupResult) => r.whyNow?.signals.find((s) => s.relevance >= 0.5) ?? null;

/** Best contact: the first reachable one (contacts are already ranked). */
export const bestContact = (r: LookupResult): Contact | null => r.contacts?.[0] ?? null;

export function buildRows(
  saved: Record<string, SavedAccount>,
  cache: Record<string, LookupResult>,
  meta: Record<string, AccountMeta>,
  now = Date.now(),
): { saved: AccountRow[]; recent: AccountRow[] } {
  const row = (domain: string, result: LookupResult, savedAt: number | null): AccountRow => ({
    domain,
    result,
    saved: savedAt !== null,
    savedAt,
    meta: meta[domain] ?? EMPTY_META,
    priority: priority(result),
    stale: isStale(result, now),
  });
  const savedRows = Object.entries(saved).map(([d, a]) => {
    // The cache may hold a fresher lookup than the saved snapshot.
    const fresher = cache[d] && cache[d].fetchedAt > a.fetchedAt ? cache[d] : a;
    return row(d, fresher, a.savedAt);
  });
  const recentRows = Object.entries(cache)
    .filter(([d]) => !saved[d])
    .map(([d, r]) => row(d, r, null));
  return { saved: savedRows, recent: recentRows };
}

export type SortKey = 'priority' | 'fit' | 'timing' | 'recent';

export const SORT_LABELS: Record<SortKey, string> = {
  priority: 'Priority',
  fit: 'ICP fit',
  timing: 'Timing',
  recent: 'Recently saved',
};

export function sortRows(rows: AccountRow[], key: SortKey): AccountRow[] {
  const val = (r: AccountRow): number => {
    switch (key) {
      case 'priority': return r.priority ?? -1;
      case 'fit': return r.result.fit?.score ?? -1;
      case 'timing': return r.result.whyNow?.timing ?? -1;
      case 'recent': return r.savedAt ?? r.result.fetchedAt;
    }
  };
  return [...rows].sort((a, b) => val(b) - val(a) || a.result.company.name.localeCompare(b.result.company.name));
}

export interface Filters {
  query: string;
  status: AccountStatus | 'all';
  hotOnly: boolean;
}

export const HOT_TIMING = 67;

export function filterRows(rows: AccountRow[], f: Filters): AccountRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status !== 'all' && r.meta.status !== f.status) return false;
    if (f.hotOnly && (r.result.whyNow?.timing ?? 0) < HOT_TIMING) return false;
    if (!q) return true;
    const { company: c, contacts, whyNow, persona } = r.result;
    const haystack = [
      c.name, r.domain, c.industry, r.meta.note, persona?.chosen,
      ...(contacts ?? []).map((p) => p.title),
      ...(whyNow?.signals ?? []).flatMap((s) => [s.label, s.detail]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
