import { describe, expect, it } from 'vitest';
import { SENIOR, excludeByTitle, functionKeywords, interleave, mergePeople, peopleFilters } from './people';
import type { Contact } from './types';

describe('functionKeywords', () => {
  it('keeps single function words and drops the rank', () => {
    expect(functionKeywords(['VP Customer Experience', 'Head of Support', 'COO'])).toEqual(['customer', 'experience', 'support']);
    expect(functionKeywords(['Vice President, Sales', 'Head of Sales Development', 'RevOps Lead'])).toEqual(['sales', 'development', 'revops']);
    expect(functionKeywords(['CTO', 'CEO'])).toEqual([]);
  });
});

describe('mergePeople', () => {
  const c = (id: string): Contact => ({ apolloId: id, firstName: id, lastName: null, lastNameObfuscated: null, title: null, hasEmail: true, rank: null });
  it('keeps the first occurrence in priority order and caps the total', () => {
    const merged = mergePeople([[c('elena'), c('kim')], [c('kim'), c('cameron')], [c('waylon'), c('elena'), c('josh')]], 4);
    expect(merged.map((x) => x.apolloId)).toEqual(['elena', 'kim', 'cameron', 'waylon']);
  });
});

describe('peopleFilters', () => {
  const rules = { headcount: null, countries: [], checks: [], personas: ['VP Customer Experience', 'Head of Support'] };
  it('fills defaults for profiles saved before "Who to look for" existed', () => {
    expect(peopleFilters(rules)).toEqual({
      titles: ['VP Customer Experience', 'Head of Support'], seniorities: SENIOR, keywords: ['customer', 'experience', 'support'], excludeTitles: [],
    });
  });
  it('uses what the user set, including an empty seniority list (any level)', () => {
    expect(peopleFilters({ ...rules, seniorities: [], keywords: ['operations'], excludeTitles: ['intern'] }))
      .toMatchObject({ seniorities: [], keywords: ['operations'], excludeTitles: ['intern'] });
  });
});

describe('excludeByTitle', () => {
  const p = (title: string) => ({ apolloId: title, firstName: '', lastName: null, lastNameObfuscated: null, title, hasEmail: true, rank: null });
  it('drops whole-word matches in any case, and keeps everything when nothing is excluded', () => {
    const people = [p('Customer Experience Associate'), p('Head of CX'), p('Associate Director, Support'), p('Internal Tools Lead'), p('Support Intern')];
    expect(excludeByTitle(people, ['associate', 'INTERN']).map((x) => x.title)).toEqual(['Head of CX', 'Internal Tools Lead']);
    expect(excludeByTitle(people, [])).toHaveLength(5);
  });
});

describe('interleave', () => {
  const p = (id: string) => ({ apolloId: id, firstName: id, lastName: null, lastNameObfuscated: null, title: id, hasEmail: true, rank: null });
  it('takes one from each list in turn', () => {
    expect(interleave([[p('a1'), p('a2'), p('a3')], [p('b1')], [p('c1'), p('c2')]]).map((x) => x.apolloId)).toEqual(['a1', 'b1', 'c1', 'a2', 'c2', 'a3']);
    expect(interleave([])).toEqual([]);
  });
});
