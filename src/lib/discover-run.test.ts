import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));
const queries: any[] = [];
vi.mock('./apollo', () => ({
  searchOrganizations: vi.fn(async (_k: string, q: any) => {
    queries.push(q);
    const n = q.page === 1 ? ['one.com', 'two.com'] : ['two.com', 'three.com'];
    return { organizations: n.map((d) => ({ id: d, name: d, primary_domain: d })), totalEntries: 120 };
  }),
  getCreditUsage: vi.fn(async () => ({})),
}));

const mem: Record<string, any> = {};
let spent = 0;
vi.mock('./storage', () => ({
  getKeys: async () => mem.keys,
  getProfile: async () => mem.profile,
  getSaved: async () => mem.saved ?? {},
  getAccountMeta: async () => ({}),
  getAllCached: async () => ({}),
  getDismissed: async () => mem.dismissed ?? [],
  getDiscover: async () => mem.discover,
  setDiscover: async (d: any) => void (mem.discover = d),
  getSettings: async () => ({ monthlyBudget: mem.budget ?? null, fetchJobs: true, scanSite: true }),
  getLedger: async () => ({ month: 'x', company: mem.used ?? 0, jobs: 0, reveal: 0, search: spent }),
  recordSpend: async () => void spent++,
  getBalance: async () => ({ available: false, checkedAt: Date.now() }),
  setBalance: async () => {},
}));

const saved = {
  'seed.com': { domain: 'seed.com', savedAt: 0, company: { apolloId: 'seed', name: 'Seed' }, fit: { score: 80, confidence: 1, checks: [], requirements: 80, overall: 80 }, whyNow: null },
};

beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k];
  queries.length = 0;
  spent = 0;
  mem.keys = { apollo: 'k', typesafe: 't' };
  mem.profile = { answers: {}, rules: { headcount: { min: 50, max: 500 }, countries: ['United States'], checks: [], personas: [] } };
  mem.saved = saved;
});

describe('runDiscover', () => {
  it('spends 1 credit per page, serves repeats from storage, and appends "more" without duplicates', async () => {
    const { runDiscover } = await import('./pipeline');
    const first = await runDiscover();
    expect(first).toMatchObject({ status: 'ok', cached: false });
    expect(spent).toBe(1);
    expect(queries[0]).toMatchObject({ lookalike_organization_ids: ['seed'], page: 1, not_organization_websites_list: ['seed.com'] });

    expect(await runDiscover()).toMatchObject({ status: 'ok', cached: true });
    expect(spent).toBe(1); // opening Discover again is free

    const more = await runDiscover({ more: true });
    expect(spent).toBe(2);
    expect(queries[1].page).toBe(2);
    if (more.status === 'ok') expect(more.result.candidates.map((c) => c.domain)).toEqual(['one.com', 'two.com', 'three.com']);
  });

  it('needs saved accounts, and asks before going over budget', async () => {
    const { runDiscover } = await import('./pipeline');
    mem.saved = {};
    expect(await runDiscover()).toEqual({ status: 'no_seeds' });
    mem.saved = saved;
    mem.budget = 10;
    mem.used = 10;
    expect(await runDiscover()).toMatchObject({ status: 'over_budget', cost: 1 });
    expect(spent).toBe(0);
    expect(await runDiscover({ allowOverBudget: true })).toMatchObject({ status: 'ok' });
  });

  it('keeps dismissed companies out of the search', async () => {
    const { runDiscover } = await import('./pipeline');
    mem.dismissed = ['nope.com'];
    await runDiscover();
    expect(queries[0].not_organization_websites_list).toContain('nope.com');
  });
});
