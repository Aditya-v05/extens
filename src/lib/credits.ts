/**
 * Apollo credit accounting. Per Apollo's API pricing: organization enrichment = 1 credit,
 * job postings = 1 credit per page, people enrichment = 1 credit when it returns data,
 * organization search (Discover) = 1 credit per page. People API search is free.
 */

export type SpendKind = 'company' | 'jobs' | 'reveal' | 'search';

/** What Sift itself has spent this calendar month (local time). */
export interface Ledger {
  month: string;
  company: number;
  jobs: number;
  reveal: number;
  /** Discover searches; missing on ledgers written before Discover existed. */
  search?: number;
}

export interface Settings {
  /** Monthly cap on credits Sift may spend; null = no cap. */
  monthlyBudget: number | null;
  /** Fetch job postings for "why now" (1 extra credit per lookup). */
  fetchJobs: boolean;
  /** Read the company's own pricing/blog/changelog/security pages (free). */
  scanSite: boolean;
}

/** Apollo's own balance, readable only with a master API key. */
export type Balance =
  | { available: true; limit: number; consumed: number; leftOver: number; cycleEnd: string | null; checkedAt: number }
  | { available: false; checkedAt: number };

export const DEFAULT_SETTINGS: Settings = { monthlyBudget: null, fetchJobs: true, scanSite: true };

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function emptyLedger(month = monthKey()): Ledger {
  return { month, company: 0, jobs: 0, reveal: 0, search: 0 };
}

/** A ledger from a previous month counts as empty. */
export function current(ledger: Ledger | undefined, month = monthKey()): Ledger {
  return ledger && ledger.month === month ? ledger : emptyLedger(month);
}

export function addSpend(ledger: Ledger | undefined, kind: SpendKind, n = 1, month = monthKey()): Ledger {
  const l = current(ledger, month);
  return { ...l, [kind]: (l[kind] ?? 0) + n };
}

export const totalSpent = (l: Ledger) => l.company + l.jobs + l.reveal + (l.search ?? 0);

/** Credits a fresh (uncached) lookup will spend. */
export const lookupCost = (s: Settings) => 1 + (s.fetchJobs ? 1 : 0);

export function overBudget(ledger: Ledger, settings: Settings, upcoming: number): boolean {
  return settings.monthlyBudget !== null && totalSpent(ledger) + upcoming > settings.monthlyBudget;
}

/** Parse Apollo's credit_usage_stats response. Lead credits are what enrichment draws on. */
export function parseBalance(body: any, now = Date.now()): Balance {
  const lead = body?.credit_usage_stats?.lead_credit;
  if (!lead || typeof lead.limit !== 'number') return { available: false, checkedAt: now };
  return {
    available: true,
    limit: lead.limit,
    consumed: lead.consumed ?? lead.limit - (lead.left_over ?? 0),
    leftOver: lead.left_over ?? lead.limit - (lead.consumed ?? 0),
    cycleEnd: body?.current_credit_cycle?.end_date ?? null,
    checkedAt: now,
  };
}
