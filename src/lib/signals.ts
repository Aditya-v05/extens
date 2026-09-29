import type { ApolloOrg, JobPosting } from './apollo';
import type { Evidence, SignalKind } from './types';

/** A fact-based signal waiting for Jev to judge its relevance. */
export interface SignalCandidate {
  kind: Exclude<SignalKind, 'hiring'>;
  label: string;
  detail?: string;
  evidence: Evidence[];
  /** What Jev sees. */
  fact: string;
}

/** An open role waiting for Jev to judge whether it's relevant to the seller. */
export interface JobCandidate {
  title: string;
  url: string | null;
  postedAt: string | null;
  daysOpen: number | null;
}

const DAY = 24 * 60 * 60 * 1000;
/** Postings not seen by Apollo for longer than this are treated as closed. */
const STALE_DAYS = 45;
export const MAX_JOBS = 40;
/** Only funding this recent counts as a timing signal. */
const FUNDING_WINDOW_MONTHS = 24;

const pct = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x * 100)}%`;
const monthsBetween = (a: number, b: number) => Math.max(0, Math.round((b - a) / (30.44 * DAY)));
const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function agoLabel(months: number): string {
  if (months < 1) return 'this month';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const y = Math.round(months / 12);
  return `${y} year${y === 1 ? '' : 's'} ago`;
}

const LOCATION_WORDS =
  /\b(remote|hybrid|on-?site|anywhere|global|worldwide|time ?zones?|pacific|mountain|central|eastern|pst|pt|mst|cst|est|et|cet|gmt|utc|emea|apac|amer|americas|latam|na|north america|europe|eu|us|usa|u\.s\.|uk|united states|united kingdom|england|ireland|canada|australia|germany|france|spain|netherlands|india|singapore|japan|brazil|mexico)\b/i;

/** Cities that often get glued onto titles without a separator ("Solutions Engineer New Chicago"). */
const MAJOR_CITIES = [
  'San Francisco', 'New York', 'NYC', 'London', 'Dublin', 'Sydney', 'Melbourne', 'Chicago', 'Austin', 'Boston',
  'Seattle', 'Denver', 'Los Angeles', 'Atlanta', 'Miami', 'Toronto', 'Vancouver', 'Montreal', 'Berlin', 'Munich',
  'Paris', 'Amsterdam', 'Madrid', 'Barcelona', 'Lisbon', 'Stockholm', 'Zurich', 'Singapore', 'Bangalore', 'Bengaluru',
  'Tel Aviv', 'Tokyo', 'Sao Paulo', 'Mexico City',
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Strip decorations ("→"), trailing location segments, and trailing glued-on places or "New" badges,
 * so the same role posted in several places ("CSM, New York" / "CSM Remote - EMEA") merges into one.
 */
export function normalizeJobTitle(title: string, places: (string | null | undefined)[] = []): string {
  const known = [...new Set([...MAJOR_CITIES, ...places].filter((p): p is string => !!p && p.length > 1))];
  const lower = known.map((p) => p.toLowerCase());
  const isLocation = (seg: string) => LOCATION_WORDS.test(seg) || lower.some((p) => seg.toLowerCase().includes(p));
  const trailing = new RegExp(`\\s+(?:${[...known.map(escapeRe), 'new', 'remote', 'hybrid'].join('|')})$`, 'i');

  const segments = title
    .replace(/[→»›]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s*(?:[,;]|\s[-–—|]\s|\()\s*/)
    .map((seg) => seg.replace(/\)$/, '').trim())
    .filter(Boolean);
  while (segments.length > 1 && isLocation(segments[segments.length - 1]!)) segments.pop();

  let last = segments[segments.length - 1] ?? '';
  for (let stripped = last.replace(trailing, ''); stripped !== last && stripped; stripped = last.replace(trailing, '')) {
    last = stripped;
  }
  segments[segments.length - 1] = last;
  return segments.join(', ');
}

export function jobCandidates(jobs: JobPosting[], now: number): JobCandidate[] {
  // Every place this company posts in, so "Consultant Sydney" is recognized even without a comma.
  const places = [...new Set(jobs.flatMap((j) => [j.city, j.state, j.country]))];
  const byTitle = new Map<string, JobCandidate>();
  for (const j of jobs) {
    const seen = Date.parse(j.lastSeenAt ?? j.postedAt ?? '');
    if (Number.isFinite(seen) && now - seen > STALE_DAYS * DAY) continue;
    const title = normalizeJobTitle(j.title, places);
    const key = title.toLowerCase();
    const posted = Date.parse(j.postedAt ?? '');
    const daysOpen = Number.isFinite(posted) ? Math.max(0, Math.round((now - posted) / DAY)) : null;
    const existing = byTitle.get(key);
    // Keep the earliest posting of a title: it says how long they've been looking.
    if (!existing || (daysOpen !== null && (existing.daysOpen === null || daysOpen > existing.daysOpen))) {
      byTitle.set(key, { title, url: j.url ?? existing?.url ?? null, postedAt: j.postedAt, daysOpen });
    }
  }
  return [...byTitle.values()].sort((a, b) => (a.daysOpen ?? 1e9) - (b.daysOpen ?? 1e9)).slice(0, MAX_JOBS);
}

export function signalCandidates(org: ApolloOrg, jobs: JobCandidate[], now: number): SignalCandidate[] {
  const out: SignalCandidate[] = [];
  const apolloEvidence: Evidence = { label: 'Apollo headcount data' };

  const g6 = num(org.organization_headcount_six_month_growth);
  const g12 = num(org.organization_headcount_twelve_month_growth);
  const growing = (g6 ?? 0) >= 0.05 || (g12 ?? 0) >= 0.1;
  const shrinking = !growing && ((g6 ?? 0) <= -0.05 || (g12 ?? 0) <= -0.1);
  if (growing || shrinking) {
    // Lead with the 6-month number when it crosses the threshold on its own; it's the fresher signal.
    const lead6 = g6 !== null && (growing ? g6 >= 0.05 : g6 <= -0.05);
    const label = lead6 ? `Headcount ${pct(g6)} in 6 months` : `Headcount ${pct(g12!)} in 12 months`;
    const detail = lead6 && g12 !== null ? `${pct(g12)} in 12 months` : undefined;
    const parts = [g6 !== null && `${pct(g6)} over 6 months`, g12 !== null && `${pct(g12)} over 12 months`].filter(Boolean);
    out.push({
      kind: growing ? 'headcount_growth' : 'headcount_decline',
      label,
      detail,
      evidence: [apolloEvidence],
      fact: `Company headcount changed ${parts.join(' and ')}.`,
    });
  }

  const funding = latestFunding(org);
  if (funding) {
    const months = monthsBetween(Date.parse(funding.date), now);
    if (months <= FUNDING_WINDOW_MONTHS) {
      const amount = funding.amount ? `${funding.currency ?? '$'}${funding.amount}` : '';
      const round = funding.type ?? 'funding';
      const acquired = /merger|acquisition|acquired/i.test(round);
      out.push({
        kind: 'funding',
        label: acquired ? `Merger / acquisition${amount ? ` (${amount})` : ''}` : `Raised ${amount ? `${amount} ` : ''}${round}`,
        detail: `${monthYear(funding.date)} · ${agoLabel(months)}`,
        evidence: [{ label: funding.url ? 'Announcement' : 'Apollo funding data', url: funding.url, date: funding.date }],
        fact: `Company ${acquired ? 'went through a merger or acquisition' : `raised ${amount ? `${amount} ` : ''}${round}`} ${agoLabel(months)}${funding.investors ? ` from ${funding.investors}` : ''}.`,
      });
    }
  }

  if (jobs.length >= 3) {
    const recent = jobs.filter((j) => j.daysOpen !== null && j.daysOpen <= 30).length;
    out.push({
      kind: 'hiring_volume',
      label: `${jobs.length}${jobs.length >= MAX_JOBS ? '+' : ''} open roles`,
      detail: recent ? `${recent} posted in the last 30 days` : undefined,
      evidence: [{ label: 'Apollo job postings' }],
      fact: `Company has ${jobs.length} open roles, ${recent} posted in the last 30 days, at ${org.estimated_num_employees ?? 'an unknown number of'} employees.`,
    });
  }
  return out;
}

interface Funding {
  date: string;
  type: string | null;
  amount: string | null;
  currency: string | null;
  url: string | null;
  investors: string | null;
}

function latestFunding(org: ApolloOrg): Funding | null {
  const events: any[] = Array.isArray(org.funding_events) ? org.funding_events : [];
  const dated = events.filter((e) => e?.date && Number.isFinite(Date.parse(e.date)));
  dated.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const e = dated[0];
  if (e) return { date: e.date, type: e.type ?? null, amount: e.amount ?? null, currency: e.currency ?? null, url: e.news_url ?? null, investors: e.investors ?? null };
  if (org.latest_funding_round_date && Number.isFinite(Date.parse(org.latest_funding_round_date))) {
    return { date: org.latest_funding_round_date, type: org.latest_funding_stage ?? null, amount: null, currency: null, url: null, investors: null };
  }
  return null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
