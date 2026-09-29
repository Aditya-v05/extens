import { describe, expect, it } from 'vitest';
import type { Answer } from './jev';
import { applyRanks, checkState, checksSummary, mapFit, upgradeFit, mapPersona, mapSiteSignals, mapWhyNow } from './mapping';
import type { Contact, Profile } from './types';

const profile: Profile = {
  answers: { sells: 'x', icp: 'y', buyers: 'z' },
  rules: { headcount: null, countries: [], checks: ['B2B SaaS', 'Large support team'], personas: ['Head of Support', 'COO'] },
  updatedAt: 0,
};

// Shapes observed from the live API (jev-1.13.0).
const answers: Record<string, Answer> = {
  icp_fit: { type: 'score', score: 2.1, confidence: 0.5, probabilities: {} },
  check_0: { type: 'noul', noul: 0.97 },
  check_1: { type: 'noul', noul: 0.2 },
  persona: { type: 'choice', choice: 'persona_0', confidence: 0.89, probabilities: { persona_0: 0.91, persona_1: 0.03, none_fit: 0.06 } },
};

describe('mapFit', () => {
  it('maps nouls to met / unsure / not met and blends requirements with the overall score', () => {
    const fit = mapFit(answers, profile, [{ label: '50–500 employees', pass: true, state: 'met', credit: 1, source: 'rule' }])!;
    expect(fit.overall).toBe(53);
    expect(fit.checks.map((c) => [c.label, c.state])).toEqual([
      ['50–500 employees', 'met'], ['B2B SaaS', 'met'], ['Large support team', 'not_met'],
    ]);
    // requirements = (1 + 0.97 + 0.2) / 3 = 72; score = 0.75 × 72 + 0.25 × 53 = 67
    expect([fit.requirements, fit.score]).toEqual([72, 67]);
  });

  it('scores the real Gorgias lookup from 2026-09-29 by the requirements, not just the overall view', () => {
    const gorgias: Record<string, Answer> = {
      icp_fit: { type: 'score', score: 2.1, confidence: 0.4, probabilities: {} },
      check_0: { type: 'noul', noul: 0.96 },
      check_1: { type: 'noul', noul: 0.5 },
    };
    const p = { ...profile, rules: { ...profile.rules, checks: ['Series A–C SaaS companies', 'large customer support teams'] } };
    const rules = [
      { label: '50–500 employees', source: 'rule' as const, pass: false, state: 'near' as const, credit: 0.5 },
      { label: 'Based in United States', source: 'rule' as const, pass: true, state: 'met' as const, credit: 1 },
    ];
    const fit = mapFit(gorgias, p, rules)!;
    expect(fit.checks.map((c) => c.state)).toEqual(['near', 'met', 'met', 'unsure']);
    expect(checksSummary(fit.checks)).toBe('2 of 4 met, 1 near miss, 1 unsure');
    // requirements = (0.5 + 1 + 0.96 + 0.5) / 4 = 74; score = 0.75 × 74 + 0.25 × 53 = 69 (was 53)
    expect([fit.requirements, fit.overall, fit.score]).toEqual([74, 53, 69]);
  });

  it('falls back to the overall score when there are no checks, and ignores checks without data', () => {
    expect(mapFit(answers, { ...profile, rules: { ...profile.rules, checks: [] } }, [])!.score).toBe(53);
    const fit = mapFit(answers, { ...profile, rules: { ...profile.rules, checks: [] } }, [
      { label: 'x', source: 'rule', pass: null, state: 'unknown', credit: null },
    ])!;
    expect([fit.requirements, fit.score]).toEqual([null, 53]);
  });

  it('upgrades results cached before requirement-based scoring', () => {
    // The real linear.app result as stored before this change: score = overall only.
    const old = {
      score: 35, confidence: 0.4,
      checks: [
        { label: '50–500 employees', source: 'rule' as const, pass: true, detail: '180 employees' },
        { label: 'Based in United States', source: 'rule' as const, pass: true },
        { label: 'Series A–C SaaS companies', source: 'jev' as const, pass: true, p: 0.94 },
        { label: 'large customer support teams', source: 'jev' as const, pass: false, p: 0.27 },
      ],
    };
    const fit = upgradeFit(old)!;
    expect(fit.checks.map((c) => c.state)).toEqual(['met', 'met', 'met', 'not_met']);
    // requirements = (1 + 1 + 0.94 + 0.27) / 4 = 80; score = 0.75 × 80 + 0.25 × 35 = 69
    expect([fit.requirements, fit.overall, fit.score]).toEqual([80, 35, 69]);
    expect(upgradeFit(fit)).toBe(fit); // already current: untouched
  });

  it('reads the state of checks cached before states existed', () => {
    expect(checkState({ label: 'x', source: 'jev', pass: true })).toBe('met');
    expect(checkState({ label: 'x', source: 'rule', pass: null })).toBe('unknown');
  });
  it('returns null without a fit answer', () => expect(mapFit({}, profile, [])).toBeNull());
});

describe('mapPersona', () => {
  it('maps choice ids back to titles', () => {
    expect(mapPersona(answers, profile)).toEqual({
      chosen: 'Head of Support', confidence: 0.89, distribution: { 'Head of Support': 0.91, COO: 0.03, 'None fit': 0.06 },
    });
  });
  it('handles none_fit', () => {
    const a = { persona: { type: 'choice', choice: 'none_fit', confidence: 0.7, probabilities: {} } } as Record<string, Answer>;
    expect(mapPersona(a, profile)?.chosen).toBeNull();
  });
});

describe('applyRanks', () => {
  const c = (id: string, hasEmail = true): Contact => ({ apolloId: id, firstName: id, lastName: null, lastNameObfuscated: null, title: null, hasEmail, rank: null });
  it('sorts reachable people first, then by rank', () => {
    const ranked = applyRanks([c('a'), c('b', false), c('c')], {
      rank_0: { type: 'score', score: 1, confidence: 1, probabilities: {} },
      rank_1: { type: 'score', score: 3, confidence: 1, probabilities: {} },
      rank_2: { type: 'score', score: 2.5, confidence: 1, probabilities: {} },
    });
    expect(ranked.map((x) => [x.apolloId, x.rank])).toEqual([['c', 83], ['a', 33], ['b', 100]]);
  });
});

describe('mapWhyNow', () => {
  const candidates = [
    { kind: 'funding' as const, label: 'Raised $82M Series C', evidence: [], fact: '' },
    { kind: 'hiring_volume' as const, label: '24 open roles', evidence: [], fact: '' },
  ];
  const jobs = [
    { title: 'Deal Desk', url: null, postedAt: null, daysOpen: 10 },
    { title: 'Customer Success Manager', url: 'https://j/1', postedAt: null, daysOpen: 5 },
    { title: 'Support Specialist', url: 'https://j/2', postedAt: null, daysOpen: 3 },
  ];
  it('rolls relevant jobs into one hiring signal and sorts by relevance', () => {
    const w = mapWhyNow({
      timing: { type: 'score', score: 2, confidence: 0.6, probabilities: {} },
      job_0: { type: 'noul', noul: 0.1 },
      job_1: { type: 'noul', noul: 0.8 },
      job_2: { type: 'noul', noul: 0.9 },
      signal_0: { type: 'noul', noul: 0.4 },
      signal_1: { type: 'noul', noul: 0.6 },
    }, candidates, jobs, 'ok');
    expect(w.timing).toBe(67);
    expect(w.signals.map((s) => [s.label, s.relevance])).toEqual([
      ['Hiring 2 relevant roles', 0.9], ['24 open roles', 0.6], ['Raised $82M Series C', 0.4],
    ]);
    expect(w.signals[0]!.detail).toBe('Support Specialist, Customer Success Manager');
    expect(w.signals[0]!.evidence.map((e) => e.url)).toEqual(['https://j/2', 'https://j/1']);
  });
});

describe('mapSiteSignals', () => {
  const snip = (text: string, url = 'https://acme.com/blog/x', date: string | null = null) => ({ text, url, source: 'blog' as const, date });
  const choice = (c: string, p: number) => ({ type: 'choice' as const, choice: c, confidence: p, probabilities: { [c]: p } });
  it('groups by type, drops none and unsure labels, and quotes the most relevant snippet', () => {
    const snippets = [
      snip('SOC 2 Type II certified', 'https://acme.com/security'),
      snip('Introducing Acme AI'),
      snip('ISO 27001 certified', 'https://acme.com/security'),
      snip('How we rebuilt our search index'),
      snip('Maybe an expansion?'),
    ];
    const signals = mapSiteSignals({
      site_type_0: choice('security_compliance', 0.9), site_rel_0: { type: 'noul', noul: 0.3 },
      site_type_1: choice('ai_launch', 0.8), site_rel_1: { type: 'noul', noul: 0.6 },
      site_type_2: choice('security_compliance', 0.85), site_rel_2: { type: 'noul', noul: 0.7 },
      site_type_3: choice('none', 0.9), site_rel_3: { type: 'noul', noul: 0.9 },
      site_type_4: choice('expansion', 0.4), site_rel_4: { type: 'noul', noul: 0.9 },
    }, snippets);
    expect(signals.map((s) => [s.siteType, s.label, s.detail, s.relevance, s.evidence.length])).toEqual([
      ['security_compliance', 'Security & compliance', 'ISO 27001 certified', 0.7, 2],
      ['ai_launch', 'Shipping AI', 'Introducing Acme AI', 0.6, 1],
    ]);
    expect(signals.every((s) => s.kind === 'site')).toBe(true);
  });
});
