import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
import type { LookupResult } from './types';

describe('toCsv', () => {
  it('escapes cells and writes one row per contact', () => {
    const acct = {
      domain: 'acme.com', fetchedAt: 0, savedAt: Date.UTC(2026, 8, 29),
      company: { name: 'Acme, Inc.' }, fit: { score: 80 }, persona: { chosen: 'COO' },
      whyNow: { timing: 67, jobsStatus: 'ok', signals: [{ label: 'Hiring 2 relevant roles', detail: 'CSM, Support', relevance: 0.8 }] },
      contacts: [{ firstName: 'Ann', lastName: 'Lee', title: 'COO "ops"', rank: 90, email: 'ann@acme.com', emailStatus: 'verified' }],
    } as unknown as LookupResult & { savedAt: number };
    const lines = toCsv([acct]).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('"Acme, Inc.",acme.com,80,67,"Hiring 2 relevant roles: CSM, Support",COO,Ann,Lee,"COO ""ops""",90,ann@acme.com,verified,,2026-09-29T00:00:00.000Z');
  });
});
