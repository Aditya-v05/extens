import { describe, expect, it } from 'vitest';
import type { Answer } from './jev';
import { applyRanks, mapFit, mapPersona, mapWhyNow } from './mapping';
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
  it('maps the 5-level score to 0–100 and nouls to checks', () => {
    const fit = mapFit(answers, profile, [{ label: '50–500 employees', pass: true, source: 'rule' }])!;
    expect(fit.score).toBe(53);
    expect(fit.checks.map((c) => [c.label, c.pass])).toEqual([
      ['50–500 employees', true], ['B2B SaaS', true], ['Large support team', false],
    ]);
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
