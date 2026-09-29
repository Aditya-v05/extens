import { describe, expect, it } from 'vitest';
import { applyReveals, revealable, splitContacts, withFocus } from './contacts';
import type { Contact, LookupResult } from './types';

const c = (id: string, rank: number | null, extra: Partial<Contact> = {}): Contact => ({
  apolloId: id, firstName: id, lastName: null, lastNameObfuscated: null, title: null, hasEmail: true, rank, ...extra,
});
const ids = (xs: Contact[]) => xs.map((x) => x.apolloId);

describe('splitContacts', () => {
  it('features two very good contacts together', () => {
    const { featured, others } = splitContacts([c('varun', 88), c('hamza', 82), c('igor', 70), c('dan', 55)]);
    expect(ids(featured)).toEqual(['varun', 'hamza']); // 82 is within 10 of 88; 70 is not
    expect(ids(others)).toEqual(['igor', 'dan']);
  });

  it('caps at three and needs a solid rank on its own', () => {
    expect(ids(splitContacts([c('a', 90), c('b', 89), c('c', 88), c('d', 87)]).featured)).toEqual(['a', 'b', 'c']);
    // Best is only 58: others within 10 still don't reach 60, so the best stands alone.
    expect(ids(splitContacts([c('a', 58), c('b', 55)]).featured)).toEqual(['a']);
  });

  it('never features someone without an email next to the best', () => {
    expect(ids(splitContacts([c('a', 90), c('b', 88, { hasEmail: false })]).featured)).toEqual(['a']);
  });

  it('handles empty and unranked lists', () => {
    expect(splitContacts([])).toEqual({ featured: [], others: [] });
    expect(ids(splitContacts([c('a', null), c('b', null)]).featured)).toEqual(['a']);
  });
});

describe('revealable / applyReveals', () => {
  it('lists only unrevealed people with an email', () => {
    expect(ids(revealable([c('a', 1), c('b', 1, { hasEmail: false }), c('c', 1, { revealedAt: 5 })]))).toEqual(['a']);
  });

  it('patches several contacts in one result', () => {
    const result = { contacts: [c('a', 90), c('b', 80), c('c', 70)] } as LookupResult;
    const out = applyReveals(result, {
      a: { lastName: 'Ax', email: 'a@x.com', emailStatus: 'verified', linkedin: null, revealedAt: 1 },
      c: { lastName: 'Cx', email: null, emailStatus: null, linkedin: null, revealedAt: 1 },
    });
    expect(out.contacts!.map((x) => [x.apolloId, x.email ?? null, x.revealedAt ?? null])).toEqual([
      ['a', 'a@x.com', 1], ['b', null, null], ['c', null, 1],
    ]);
  });
});

describe('withFocus', () => {
  it('adds the profile person when missing, and merges what we learned when present', () => {
    const list = [c('a', 80), c('b', 70)];
    expect(ids(withFocus(list, c('z', null)))).toEqual(['a', 'b', 'z']);
    const merged = withFocus(list, c('b', null, { email: 'b@x.com', headline: 'Head of CX' }));
    expect(ids(merged)).toEqual(['a', 'b']);
    expect(merged[1]).toMatchObject({ rank: 70, email: 'b@x.com', headline: 'Head of CX' });
    expect(withFocus(list, undefined)).toBe(list);
  });
});
