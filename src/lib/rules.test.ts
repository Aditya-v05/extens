import { describe, expect, it } from 'vitest';
import { evaluateRules, generateRules, parseCountries, parseHeadcount } from './rules';
import type { Company } from './types';

describe('parseHeadcount', () => {
  it.each([
    ['50–500 employees', 50, 500],
    ['50-500 employees', 50, 500],
    ['between 1k to 5k people', 1000, 5000],
    ['200+ employees', 200, null],
    ['under 100 staff', null, 100],
    ['more than 1,000 employees', 1000, null],
  ])('%s', (text, min, max) => expect(parseHeadcount(text)).toMatchObject({ min, max }));

  it('ignores numbers that are not headcount', () => {
    expect(parseHeadcount('Series A–C SaaS with $5M+ ARR')).toBeNull();
  });
});

describe('parseCountries', () => {
  it('maps aliases and regions', () => {
    expect(parseCountries('SaaS in North America').countries).toEqual(['United States', 'Canada']);
    expect(parseCountries('UK and DACH fintechs').countries.sort()).toEqual(['Austria', 'Germany', 'Switzerland', 'United Kingdom']);
  });
  it('treats lowercase "us" as a pronoun', () => {
    expect(parseCountries('companies like us').countries).toEqual([]);
    expect(parseCountries('based in the US').countries).toEqual(['United States']);
  });
});

describe('generateRules', () => {
  it('splits the ICP into exact rules, checks and personas', () => {
    const rules = generateRules({
      sells: 'AI support QA software',
      icp: 'Series A–C SaaS companies, 50–500 employees, based in the US, with large customer support teams.',
      buyers: 'VP Customer Experience, Head of Support or COO',
    });
    expect(rules.headcount).toEqual({ min: 50, max: 500 });
    expect(rules.countries).toEqual(['United States']);
    expect(rules.checks).toEqual(['Series A–C SaaS companies', 'large customer support teams']);
    expect(rules.personas).toEqual(['VP Customer Experience', 'Head of Support', 'COO']);
    // "Who to look for" is filled in from the personas.
    expect(rules.seniorities).toEqual(['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director']);
    expect(rules.keywords).toEqual(['customer', 'experience', 'support']);
    expect(rules.excludeTitles).toEqual([]);
  });
});

describe('evaluateRules', () => {
  const company = { headcount: 180, country: 'United States' } as Company;
  it('passes, fails and reports unknowns', () => {
    const rules = { headcount: { min: 50, max: 500 }, countries: ['Canada'], checks: [], personas: [] };
    expect(evaluateRules(rules, company).map((c) => c.pass)).toEqual([true, false]);
    expect(evaluateRules(rules, { ...company, headcount: null, country: null }).map((c) => c.pass)).toEqual([null, null]);
  });
  it('treats headcount just outside a limit as a near miss with half credit', () => {
    const rules = { headcount: { min: 50, max: 500 }, countries: [], checks: [], personas: [] };
    const at = (n: number) => evaluateRules(rules, { ...company, headcount: n })[0]!;
    expect([at(500).state, at(500).credit]).toEqual(['met', 1]);
    expect([at(520).state, at(520).credit, at(520).detail]).toEqual(['near', 0.5, '520, just over']);
    expect([at(550).state, at(551).state]).toEqual(['near', 'not_met']);
    expect([at(46).state, at(46).detail, at(44).state]).toEqual(['near', '46, just under', 'not_met']);
  });

  it('skips rules that are not set', () => {
    expect(evaluateRules({ headcount: null, countries: [], checks: [], personas: [] }, company)).toEqual([]);
  });
});
