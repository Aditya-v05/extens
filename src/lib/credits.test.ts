import { describe, expect, it } from 'vitest';
import { addSpend, current, emptyLedger, lookupCost, monthKey, overBudget, parseBalance, totalSpent } from './credits';

describe('ledger', () => {
  it('adds spend by kind within a month', () => {
    let l = addSpend(undefined, 'company', 1, '2026-09');
    l = addSpend(l, 'jobs', 1, '2026-09');
    l = addSpend(l, 'reveal', 2, '2026-09');
    expect(l).toEqual({ month: '2026-09', company: 1, jobs: 1, reveal: 2 });
    expect(totalSpent(l)).toBe(4);
  });

  it('starts fresh in a new month', () => {
    const sept = addSpend(undefined, 'company', 5, '2026-09');
    expect(current(sept, '2026-10')).toEqual(emptyLedger('2026-10'));
    expect(addSpend(sept, 'reveal', 1, '2026-10')).toEqual({ month: '2026-10', company: 0, jobs: 0, reveal: 1 });
  });

  it('formats month keys', () => expect(monthKey(new Date(2026, 0, 5))).toBe('2026-01'));
});

describe('budget', () => {
  const spent = { month: '2026-09', company: 8, jobs: 8, reveal: 2 }; // 18
  it('costs 2 per lookup with job postings, 1 without', () => {
    expect(lookupCost({ monthlyBudget: null, fetchJobs: true })).toBe(2);
    expect(lookupCost({ monthlyBudget: null, fetchJobs: false })).toBe(1);
  });
  it('blocks only when the next lookup would exceed the budget', () => {
    expect(overBudget(spent, { monthlyBudget: 20, fetchJobs: true }, 2)).toBe(false);
    expect(overBudget(spent, { monthlyBudget: 19, fetchJobs: true }, 2)).toBe(true);
    expect(overBudget(spent, { monthlyBudget: null, fetchJobs: true }, 2)).toBe(false);
  });
});

describe('parseBalance', () => {
  it('reads lead credits and the cycle end (documented response shape)', () => {
    const body = {
      credit_usage_stats: { lead_credit: { limit: 10000, consumed: 2500, left_over: 7500 }, export_credit: { limit: 5000 } },
      current_credit_cycle: { start_date: '2026-09-01T00:00:00.000Z', end_date: '2026-10-01T00:00:00.000Z' },
    };
    expect(parseBalance(body, 1)).toEqual({
      available: true, limit: 10000, consumed: 2500, leftOver: 7500, cycleEnd: '2026-10-01T00:00:00.000Z', checkedAt: 1,
    });
  });
  it('marks unexpected shapes unavailable', () => expect(parseBalance({ error: 'x' }, 1)).toEqual({ available: false, checkedAt: 1 }));
});
