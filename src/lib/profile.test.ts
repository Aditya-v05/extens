import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mapProfileMatch } from './apollo';

// Trimmed from Apollo's real people/match response for a LinkedIn URL (2026-09-29), email masked.
const APOLLO_BODY = {
  person: {
    id: '6700b6131cdec9000139bae8', first_name: 'Cristina', last_name: 'Cordova', title: 'Chief Operating Officer',
    headline: 'COO at Linear', email: 'cristina@linear.app', email_status: 'verified', seniority: 'c_suite',
    linkedin_url: 'http://www.linkedin.com/in/cristinajcordova', organization_id: '5dd807f270e72901507f3094',
    organization: { id: '5dd807f270e72901507f3094', name: 'Linear', primary_domain: 'linear.app' },
  },
};

describe('mapProfileMatch', () => {
  it('reads the person (revealed, with headline) and their company', () => {
    const m = mapProfileMatch(APOLLO_BODY, 7)!;
    expect(m.company).toEqual({ apolloId: '5dd807f270e72901507f3094', domain: 'linear.app', name: 'Linear' });
    expect(m.person).toMatchObject({ apolloId: '6700b6131cdec9000139bae8', lastName: 'Cordova', headline: 'COO at Linear', email: 'cristina@linear.app', revealedAt: 7, hasEmail: true });
  });
  it('handles no match and no company', () => {
    expect(mapProfileMatch({ person: null })).toBeNull();
    expect(mapProfileMatch({ person: { id: 'p', first_name: 'A' } })!.company.domain).toBeNull();
  });
});

// ---- runProfileLookup, with Apollo, Jev and storage mocked ----
vi.mock('wxt/browser', () => ({ browser: {} }));
let matchCalls = 0;
let apolloBody: any = APOLLO_BODY;
vi.mock('./apollo', async (orig) => ({
  ...(await orig<typeof import('./apollo')>()),
  matchLinkedin: vi.fn(async () => {
    matchCalls++;
    const { mapProfileMatch } = await orig<typeof import('./apollo')>();
    return mapProfileMatch(apolloBody, 1);
  }),
  getCreditUsage: vi.fn(async () => ({})),
}));
vi.mock('./jev', async (orig) => ({
  ...(await orig<typeof import('./jev')>()),
  ask: vi.fn(async (_k: string, _s: unknown, q: Record<string, unknown>) =>
    Object.fromEntries(Object.keys(q).map((id) => [id, { type: 'score', score: 2, confidence: 1, probabilities: {} }]))),
}));
const mem: Record<string, any> = {};
const views: any[] = [];
let spent = 0;
vi.mock('./storage', () => ({
  getKeys: async () => ({ apollo: 'k', typesafe: 't' }),
  getProfile: async () => ({ answers: { sells: 's', icp: 'i', buyers: 'b' }, rules: { headcount: null, countries: [], checks: [], personas: ['COO'] } }),
  getSettings: async () => ({ monthlyBudget: mem.budget ?? null, fetchJobs: true, scanSite: true }),
  getLedger: async () => ({ month: 'x', company: mem.used ?? 0, jobs: 0, reveal: 0 }),
  recordSpend: async () => void spent++,
  putReveals: async (r: any) => void (mem.reveals = { ...mem.reveals, ...r }),
  getProfileMatch: async (url: string) => mem.matches?.[url] ?? null,
  putProfileMatch: async (url: string, m: any) => void (mem.matches = { ...mem.matches, [url]: m }),
  getCached: async (d: string) => mem.cache?.[d] ?? null,
  putCached: async (r: any) => void (mem.cache = { ...mem.cache, [r.domain]: r }),
  withReveals: async (cs: any[]) => cs,
  setView: async (_w: number, v: any) => void views.push(v),
  getBalance: async () => ({ available: false, checkedAt: Date.now() }),
  setBalance: async () => {},
}));

const URL_ = 'https://www.linkedin.com/in/cristinajcordova';
const linearCached = {
  domain: 'linear.app', fetchedAt: Date.now(), company: { apolloId: 'org', name: 'Linear', domain: 'linear.app' },
  fit: { score: 70, confidence: 1, checks: [], requirements: null, overall: 70 }, persona: null,
  contacts: [{ apolloId: 'erin', firstName: 'Erin', lastName: null, lastNameObfuscated: 'F***y', title: 'Customer Experience', hasEmail: true, rank: 40 }],
  whyNow: { timing: 50, signals: [], jobsStatus: 'ok' },
};

beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k];
  views.length = 0;
  matchCalls = 0;
  spent = 0;
  apolloBody = APOLLO_BODY;
  mem.cache = { 'linear.app': structuredClone(linearCached) };
});

describe('runProfileLookup', () => {
  it('matches the profile once (1 credit, email saved), ranks the person into the cached company, and marks them', async () => {
    const { runProfileLookup } = await import('./pipeline');
    const out: any = await runProfileLookup(1, URL_);
    expect(matchCalls).toBe(1);
    expect(spent).toBe(1); // the match; the company came from the cache
    expect(mem.reveals['6700b6131cdec9000139bae8'].email).toBe('cristina@linear.app');
    expect(out.status).toBe('done');
    expect(out.result.profile).toEqual({ apolloId: '6700b6131cdec9000139bae8', url: URL_ });
    const ids = out.result.contacts.map((c: any) => c.apolloId);
    expect(ids).toEqual(['6700b6131cdec9000139bae8', 'erin']); // ranked 67 by Jev, above Erin's 40
    expect(mem.cache['linear.app'].contacts.map((c: any) => c.apolloId)).toContain('6700b6131cdec9000139bae8');
    expect(mem.cache['linear.app'].profile).toBeUndefined(); // the cached copy doesn't remember the profile

    // Revisiting the profile is free.
    await runProfileLookup(1, URL_);
    expect([matchCalls, spent]).toEqual([1, 1]);
  });

  it('says so when Apollo does not know the profile, or knows no company for it', async () => {
    const { runProfileLookup } = await import('./pipeline');
    apolloBody = { person: null };
    expect(await runProfileLookup(1, URL_)).toMatchObject({ status: 'not_found', domain: 'linkedin.com/in/cristinajcordova' });
    expect(spent).toBe(0);
    apolloBody = { person: { id: 'p', first_name: 'Ann', email: 'ann@x.io' } };
    expect(await runProfileLookup(1, 'https://www.linkedin.com/in/ann')).toMatchObject({ status: 'profile_no_company' });
  });

  it('asks before going over budget, and remembers it was a profile', async () => {
    const { runProfileLookup } = await import('./pipeline');
    mem.budget = 10;
    mem.used = 9;
    expect(await runProfileLookup(1, URL_)).toMatchObject({ status: 'over_budget', cost: 3, profileUrl: URL_ });
    expect(matchCalls).toBe(0);
  });
});
