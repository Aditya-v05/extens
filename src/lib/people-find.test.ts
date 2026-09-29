import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));
const calls: any[] = [];
const byQuery: Record<string, string[]> = {};
vi.mock('./apollo', () => ({
  searchPeople: vi.fn(async (_k: string, q: any) => {
    calls.push(q);
    const key = q.keywords ? `kw:${q.keywords}` : q.titles ? `titles${q.seniorities ? '+sen' : ''}` : 'fallback';
    return (byQuery[key] ?? []).map((t, i) => ({ apolloId: `${key}-${i}-${t}`, firstName: t, lastName: null, lastNameObfuscated: null, title: t, hasEmail: true, rank: null }));
  }),
}));

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(byQuery)) delete byQuery[k];
});

const filters = { titles: ['VP Customer Experience'], seniorities: ['vp', 'head'], keywords: ['customer', 'operations'], excludeTitles: ['associate'] };

describe('findPeople', () => {
  it('runs titles+seniority, one search per keyword, then titles at any level; senior results first; exclusions dropped', async () => {
    byQuery['titles+sen'] = ['VP, Customer Experience'];
    byQuery['kw:customer'] = ['Head of Customer Operations'];
    byQuery['kw:operations'] = [];
    byQuery['titles'] = ['Customer Experience Associate', 'Customer Experience Manager'];
    const { findPeople } = await import('./pipeline');
    const out = await findPeople('k', 'org1', filters);

    expect(calls.map((q) => [q.titles ?? null, q.keywords ?? null, q.seniorities ?? null])).toEqual([
      [['VP Customer Experience'], null, ['vp', 'head']],
      [null, 'customer', ['vp', 'head']],
      [null, 'operations', ['vp', 'head']],
      [['VP Customer Experience'], null, null],
    ]);
    expect(out.fallback).toBe(false);
    expect(out.contacts.map((c) => c.title)).toEqual(['VP, Customer Experience', 'Head of Customer Operations', 'Customer Experience Manager']);
  });

  it('with no seniority chosen, searches any level once per query', async () => {
    const { findPeople } = await import('./pipeline');
    await findPeople('k', 'org1', { ...filters, seniorities: [], keywords: [] });
    expect(calls).toHaveLength(2); // titles (any level) + fallback, no duplicate title search
    expect(calls[0]).toMatchObject({ titles: ['VP Customer Experience'] });
    expect(calls[0].seniorities).toBeUndefined();
  });

  it('falls back to senior people when nothing matches', async () => {
    byQuery['fallback'] = ['CEO'];
    const { findPeople } = await import('./pipeline');
    const out = await findPeople('k', 'org1', filters);
    expect(out).toMatchObject({ fallback: true });
    expect(out.contacts.map((c) => c.title)).toEqual(['CEO']);
  });
});
