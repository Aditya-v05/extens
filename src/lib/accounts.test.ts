import { describe, expect, it } from 'vitest';
import { buildRows, filterRows, isStale, priority, sortRows, type AccountRow } from './accounts';
import type { LookupResult } from './types';

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 29);

function result(domain: string, o: { fit?: number; timing?: number | null; fetchedDaysAgo?: number; industry?: string; signal?: string; title?: string } = {}): LookupResult {
  return {
    domain,
    fetchedAt: NOW - (o.fetchedDaysAgo ?? 0) * DAY,
    company: { name: domain.split('.')[0]!, domain, industry: o.industry ?? null } as LookupResult['company'],
    fit: o.fit === undefined ? null : { score: o.fit, confidence: 1, checks: [] },
    persona: null,
    contacts: o.title ? [{ apolloId: 'p', firstName: 'A', lastName: null, lastNameObfuscated: null, title: o.title, hasEmail: true, rank: 90 }] : [],
    whyNow: o.timing === undefined ? undefined : {
      timing: o.timing, jobsStatus: 'ok',
      signals: o.signal ? [{ kind: 'hiring', label: o.signal, relevance: 0.8, evidence: [] }] : [],
    },
  };
}

describe('priority', () => {
  it('is 60% fit + 40% timing', () => {
    expect(priority(result('a.com', { fit: 80, timing: 50 }))).toBe(68);
    expect(priority(result('a.com', { fit: 80, timing: null }))).toBe(48);
    expect(priority(result('a.com', { fit: 80 }))).toBe(48); // cached before why-now existed
    expect(priority(result('a.com'))).toBeNull();
  });
});

describe('isStale', () => {
  it('flags lookups older than 14 days', () => {
    expect(isStale(result('a.com', { fetchedDaysAgo: 13 }), NOW)).toBe(false);
    expect(isStale(result('a.com', { fetchedDaysAgo: 15 }), NOW)).toBe(true);
  });
});

describe('buildRows', () => {
  it('splits saved from recent, prefers a fresher cached lookup, and defaults meta', () => {
    const saved = { 'a.com': { ...result('a.com', { fit: 50, fetchedDaysAgo: 10 }), savedAt: NOW - 10 * DAY } };
    const cache = { 'a.com': result('a.com', { fit: 90, fetchedDaysAgo: 1 }), 'b.com': result('b.com', { fit: 40 }) };
    const rows = buildRows(saved, cache, { 'a.com': { status: 'contacted', note: 'hi', updatedAt: 1 } }, NOW);
    expect(rows.saved.map((r) => [r.domain, r.result.fit?.score, r.meta.status, r.saved])).toEqual([['a.com', 90, 'contacted', true]]);
    expect(rows.recent.map((r) => [r.domain, r.meta.status, r.saved])).toEqual([['b.com', 'new', false]]);
  });
});

describe('sortRows / filterRows', () => {
  const rows: AccountRow[] = buildRows(
    {
      'hot.com': { ...result('hot.com', { fit: 60, timing: 90, signal: 'Hiring 3 relevant roles', title: 'Head of Support' }), savedAt: NOW - 3 * DAY },
      'fit.com': { ...result('fit.com', { fit: 95, timing: 10, industry: 'fintech' }), savedAt: NOW - 1 * DAY },
      'none.com': { ...result('none.com'), savedAt: NOW },
    },
    {},
    { 'fit.com': { status: 'replied', note: 'Demo booked', updatedAt: 1 } },
    NOW,
  ).saved;
  const order = (rs: AccountRow[]) => rs.map((r) => r.domain);

  it('sorts by priority, fit, timing or recency; missing values go last', () => {
    expect(order(sortRows(rows, 'priority'))).toEqual(['hot.com', 'fit.com', 'none.com']); // 72 vs 61
    expect(order(sortRows(rows, 'fit'))).toEqual(['fit.com', 'hot.com', 'none.com']);
    expect(order(sortRows(rows, 'timing'))).toEqual(['hot.com', 'fit.com', 'none.com']);
    expect(order(sortRows(rows, 'recent'))).toEqual(['none.com', 'fit.com', 'hot.com']);
  });

  it('filters by status, hot timing and free text across company, note, contact title and signal', () => {
    const f = { query: '', status: 'all' as const, hotOnly: false };
    expect(order(filterRows(rows, { ...f, status: 'replied' }))).toEqual(['fit.com']);
    expect(order(filterRows(rows, { ...f, hotOnly: true }))).toEqual(['hot.com']);
    expect(order(filterRows(rows, { ...f, query: 'demo' }))).toEqual(['fit.com']);
    expect(order(filterRows(rows, { ...f, query: 'FINTECH' }))).toEqual(['fit.com']);
    expect(order(filterRows(rows, { ...f, query: 'support' }))).toEqual(['hot.com']);
    expect(order(filterRows(rows, { ...f, query: 'relevant roles' }))).toEqual(['hot.com']);
    expect(order(filterRows(rows, { ...f, query: 'nothing like this' }))).toEqual([]);
  });
});
