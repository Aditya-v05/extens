import { request } from './errors';
import type { Company, Contact } from './types';

const BASE = 'https://api.apollo.io/api/v1';

function headers(key: string): HeadersInit {
  return { 'X-Api-Key': key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
}

/** Raw organization as returned by Apollo; kept around for "why now" fields later. */
export type ApolloOrg = Record<string, any>;

export async function checkKey(key: string): Promise<boolean> {
  // auth/health answers 200 either way; is_logged_in tells us if the key is valid.
  const body = (await request('apollo', 'https://api.apollo.io/v1/auth/health', { headers: headers(key) })) as any;
  return body?.is_logged_in === true;
}

/** Team credit balance. Needs a master API key; other keys get 403. */
export async function getCreditUsage(key: string): Promise<unknown> {
  return request('apollo', `${BASE}/usage_stats/credit_usage_stats`, { method: 'POST', headers: headers(key) });
}

export async function enrichOrganization(key: string, domain: string): Promise<ApolloOrg | null> {
  const url = `${BASE}/organizations/enrich?domain=${encodeURIComponent(domain)}`;
  const body = (await request('apollo', url, { headers: headers(key) })) as any;
  const org = body?.organization;
  return org && org.id ? org : null;
}

export function mapOrganization(org: ApolloOrg, domain: string): Company {
  return {
    apolloId: org.id,
    name: org.name ?? domain,
    domain: org.primary_domain ?? domain,
    logo: org.logo_url ?? null,
    industry: org.industry ?? null,
    headcount: typeof org.estimated_num_employees === 'number' ? org.estimated_num_employees : null,
    country: org.country ?? null,
    city: org.city ?? null,
    fundingStage: org.latest_funding_stage ?? null,
    totalFunding: org.total_funding_printed ?? null,
    foundedYear: org.founded_year ?? null,
    description: org.short_description ?? null,
    keywords: Array.isArray(org.keywords) ? org.keywords.slice(0, 20) : [],
    linkedin: org.linkedin_url ?? null,
  };
}

export interface JobPosting {
  title: string;
  url: string | null;
  postedAt: string | null;
  lastSeenAt: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export async function getJobPostings(key: string, organizationId: string): Promise<JobPosting[]> {
  const url = `${BASE}/organizations/${encodeURIComponent(organizationId)}/job_postings?per_page=100`;
  const body = (await request('apollo', url, { headers: headers(key) })) as any;
  const jobs: any[] = Array.isArray(body?.organization_job_postings) ? body.organization_job_postings : [];
  return jobs
    .filter((j) => j?.title)
    .map((j) => ({
      title: String(j.title),
      url: j.url ?? null,
      postedAt: j.posted_at ?? null,
      lastSeenAt: j.last_seen_at ?? null,
      city: j.city ?? null,
      state: j.state ?? null,
      country: j.country ?? null,
    }));
}

/** Organization search with lookalikes and filters. 1 credit per page. */
export async function searchOrganizations(key: string, query: object): Promise<{ organizations: any[]; totalEntries: number }> {
  const body = (await request('apollo', `${BASE}/mixed_companies/search`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify(query),
  })) as any;
  const organizations = [...(body?.organizations ?? []), ...(body?.accounts ?? [])];
  return { organizations, totalEntries: body?.pagination?.total_entries ?? organizations.length };
}

export interface ProfileMatch {
  person: Contact;
  company: { apolloId: string | null; domain: string | null; name: string | null };
}

/** Map Apollo's people/match response (by LinkedIn URL) to a revealed contact and their company. */
export function mapProfileMatch(body: any, now = Date.now()): ProfileMatch | null {
  const p = body?.person;
  if (!p?.id) return null;
  const o = p.organization ?? {};
  const domain = (o.primary_domain ?? p.email_domain ?? '').toLowerCase() || null;
  return {
    person: {
      apolloId: p.id,
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? null,
      lastNameObfuscated: null,
      title: p.title ?? null,
      headline: p.headline ?? null,
      hasEmail: !!p.email,
      rank: null,
      email: p.email ?? null,
      emailStatus: p.email_status ?? null,
      linkedin: p.linkedin_url ?? null,
      revealedAt: now,
    },
    company: { apolloId: p.organization_id ?? o.id ?? null, domain, name: o.name ?? null },
  };
}

/** Who is on this LinkedIn profile, and where do they work? People enrichment: 1 credit when found. */
export async function matchLinkedin(key: string, linkedinUrl: string): Promise<ProfileMatch | null> {
  const body = await request('apollo', `${BASE}/people/match`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify({ linkedin_url: linkedinUrl, reveal_personal_emails: false, reveal_phone_number: false }),
  });
  return mapProfileMatch(body);
}

export interface PeopleQuery {
  organizationId: string;
  titles?: string[];
  seniorities?: string[];
  /** Free-text match across the person's fields (title, department…). */
  keywords?: string;
  perPage?: number;
}

/** People API search: free, but returns obfuscated last names and no emails. */
export async function searchPeople(key: string, q: PeopleQuery): Promise<Contact[]> {
  // Without a company filter Apollo searches everyone in its database (333k people in one test).
  if (!q.organizationId) throw new Error('People search needs a company id');
  const payload: Record<string, unknown> = {
    organization_ids: [q.organizationId],
    per_page: q.perPage ?? 15,
    page: 1,
  };
  if (q.titles?.length) payload.person_titles = q.titles;
  if (q.seniorities?.length) payload.person_seniorities = q.seniorities;
  if (q.keywords) payload.q_keywords = q.keywords;
  const body = (await request('apollo', `${BASE}/mixed_people/api_search`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify(payload),
  })) as any;
  const people: any[] = Array.isArray(body?.people) ? body.people : [];
  return people.map((p) => ({
    apolloId: p.id,
    firstName: p.first_name ?? '',
    lastName: null,
    lastNameObfuscated: p.last_name_obfuscated ?? null,
    title: p.title ?? null,
    hasEmail: p.has_email !== false,
    rank: null,
  }));
}

export interface Reveal {
  /** Apollo matched the person (and so charged a credit). */
  found: boolean;
  lastName: string | null;
  email: string | null;
  emailStatus: string | null;
  linkedin: string | null;
  title: string | null;
}

/** People enrichment by Apollo id. Spends a credit. */
export async function revealPerson(key: string, personId: string): Promise<Reveal> {
  const body = (await request('apollo', `${BASE}/people/match`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify({ id: personId, reveal_personal_emails: false, reveal_phone_number: false }),
  })) as any;
  const p = body?.person ?? {};
  return {
    found: !!body?.person,
    lastName: p.last_name ?? null,
    email: p.email ?? null,
    emailStatus: p.email_status ?? null,
    linkedin: p.linkedin_url ?? null,
    title: p.title ?? null,
  };
}
