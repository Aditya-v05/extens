import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));
const calls: any[] = [];
const byQuery: Record<string, string[]> = {};
vi.mock('./apollo', () => ({
  searchPeople: vi.fn(async (_k: string, q: any) => {
    calls.push(q);
    // e.g. "titles+sen", "kw:customer+sen", "titles", "kw:customer"; seniority alone is the fallback search.
    const what = q.keywords ? `kw:${q.keywords}` : q.titles ? 'titles' : null;
    const key = what ? `${what}${q.seniorities ? '+sen' : ''}` : 'fallback';
    return (byQuery[key] ?? []).map((t) => ({ apolloId: t /* same person, same id, in every search */, firstName: t, lastName: null, lastNameObfuscated: null, title: t, hasEmail: true, rank: null }));
  }),
}));

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(byQuery)) delete byQuery[k];
});

const filters = { titles: ['VP Customer Experience'], seniorities: ['vp', 'head'], keywords: ['customer', 'operations'], excludeTitles: ['associate'] };

describe('findPeople', () => {
  it('runs senior searches first, then titles and keywords at any level taking turns; exclusions dropped', async () => {
    byQuery['titles+sen'] = ['VP, Customer Experience'];
    byQuery['kw:customer+sen'] = ['Head of Customer Operations'];
    byQuery['titles'] = ['Customer Experience Associate', 'Customer Experience Manager'];
    // Small companies: the owner is a "Lead", found only by keyword at any level (Linear, 2026-09-29).
    byQuery['kw:customer'] = ['Customer Experience Leader', 'Customer Experience Manager'];
    byQuery['kw:operations'] = ['Product Operations Lead'];
    const { findPeople } = await import('./pipeline');
    const out = await findPeople('k', 'org1', filters);

    expect(calls.map((q) => [q.titles ? 'titles' : q.keywords, !!q.seniorities])).toEqual([
      ['titles', true], ['customer', true], ['operations', true],
      ['titles', false], ['customer', false], ['operations', false],
    ]);
    expect(out.fallback).toBe(false);
    // Senior first; then one from each any-level search in turn (the Associate is excluded).
    expect(out.contacts.map((c) => c.title)).toEqual([
      'VP, Customer Experience', 'Head of Customer Operations',
      'Customer Experience Leader', 'Product Operations Lead', 'Customer Experience Manager',
    ]);
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
