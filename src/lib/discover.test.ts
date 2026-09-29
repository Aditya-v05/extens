import { describe, expect, it } from 'vitest';
import { buildLookalikeQuery, filtersLabel, mapCandidate, mergeCandidates, pickSeeds, searchKey } from './discover';
import type { LookupResult, Rules } from './types';

const rules: Rules = { headcount: { min: 50, max: 500 }, countries: ['United States'], checks: ['x'], personas: ['y'] };
const seed = (id: string, domain = `${id}.com`) => ({ apolloId: id, name: id, domain });

describe('buildLookalikeQuery', () => {
  it('turns seeds and exact ICP rules into Apollo filters', () => {
    const q = buildLookalikeQuery(rules, [seed('a'), seed('b')], ['A.com', 'b.com', 'a.com'], 2);
    expect(q).toEqual({
      lookalike_organization_ids: ['a', 'b'],
      organization_num_employees_ranges: ['50,500'],
      organization_locations: ['united states'],
      not_organization_websites_list: ['a.com', 'b.com'],
      page: 2,
      per_page: 50,
    });
  });
  it('handles open-ended headcount, no countries, and caps seeds at 5', () => {
    const q = buildLookalikeQuery({ ...rules, headcount: { min: 200, max: null }, countries: [] }, 'abcdefg'.split('').map((x) => seed(x)), [], 1);
    expect(q.organization_num_employees_ranges).toEqual(['200,1000000']);
    expect(q.organization_locations).toBeUndefined();
    expect(q.not_organization_websites_list).toBeUndefined();
    expect(q.lookalike_organization_ids).toHaveLength(5);
  });
});

describe('filtersLabel / searchKey', () => {
  it('describes the filters in words', () => {
    expect(filtersLabel(rules)).toBe('50–500 employees, United States');
    expect(filtersLabel({ ...rules, headcount: null, countries: [] })).toBe('');
  });
  it('is stable for the same seeds in any order and changes with the rules', () => {
    expect(searchKey(rules, [seed('a'), seed('b')])).toBe(searchKey(rules, [seed('b'), seed('a')]));
    expect(searchKey(rules, [seed('a')])).not.toBe(searchKey({ ...rules, countries: ['Canada'] }, [seed('a')]));
    // chrome.storage returns objects with sorted keys; that must not change the key.
    const fromStorage = { ...rules, headcount: { max: 500, min: 50 } as Rules['headcount'] };
    expect(searchKey(fromStorage, [seed('a')])).toBe(searchKey(rules, [seed('a')]));
  });
});

describe('pickSeeds', () => {
  const acct = (domain: string, fit: number, timing: number) =>
    ({ domain, savedAt: 0, company: { apolloId: `id-${domain}`, name: domain }, fit: { score: fit, confidence: 1, checks: [], requirements: fit, overall: fit }, whyNow: { timing, signals: [], jobsStatus: 'ok' } }) as unknown as LookupResult & { savedAt: number };
  it('takes the best by priority and skips accounts marked Not a fit', () => {
    const saved = { 'a.com': acct('a.com', 50, 10), 'b.com': acct('b.com', 90, 90), 'c.com': acct('c.com', 95, 95), 'd.com': acct('d.com', 70, 0) };
    const seeds = pickSeeds(saved, { 'c.com': { status: 'not_fit', note: '', updatedAt: 0 } });
    expect(seeds.map((s) => s.domain)).toEqual(['b.com', 'd.com', 'a.com']);
  });
});

describe('mapCandidate / mergeCandidates', () => {
  it('reads both organizations and account-shaped results (real field names)', () => {
    expect(mapCandidate({ id: 'o1', name: 'Help Scout', primary_domain: 'helpscout.com', founded_year: 2011, organization_revenue_printed: '50M', organization_headcount_twelve_month_growth: 0.08 }))
      .toMatchObject({ apolloId: 'o1', domain: 'helpscout.com', foundedYear: 2011, revenue: '50M', growth12: 0.08 });
    expect(mapCandidate({ id: 'acct1', organization_id: 'o2', name: 'Kustomer', domain: 'kustomer.com' })).toMatchObject({ apolloId: 'o2', domain: 'kustomer.com' });
    expect(mapCandidate({ id: 'x' })).toBeNull();
  });
  it('appends pages without duplicates and drops anything excluded since', () => {
    const c = (d: string) => mapCandidate({ id: d, primary_domain: d })!;
    const merged = mergeCandidates([c('a.com'), c('b.com')], [c('b.com'), c('c.com'), c('d.com')], new Set(['a.com', 'd.com']));
    expect(merged.map((x) => x.domain)).toEqual(['b.com', 'c.com']);
  });
});
