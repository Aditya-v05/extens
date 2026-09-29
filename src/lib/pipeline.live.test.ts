/**
 * Live end-to-end run against Apollo + Jev. Skipped unless keys are set:
 *   APOLLO_KEY=... TYPESAFE_KEY=... npm test
 * Uses free/cheap calls only (no email reveals).
 */
import { describe, expect, it, vi } from 'vitest';
import type { Profile, ViewState } from './types';

const mem: Record<string, Record<string, unknown>> = { local: {}, session: {} };
const area = (name: 'local' | 'session') => ({
  get: async (key: string) => ({ [key]: mem[name]![key] }),
  set: async (items: Record<string, unknown>) => void Object.assign(mem[name]!, items),
});
vi.mock('wxt/browser', () => ({
  browser: { storage: { local: area('local'), session: area('session'), onChanged: { addListener() {}, removeListener() {} } } },
}));

// Vitest runs in Node; the extension's tsconfig has no Node types, so reach process via globalThis.
const env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};
const { APOLLO_KEY, TYPESAFE_KEY, LIVE_DOMAIN } = env;

describe.skipIf(!APOLLO_KEY || !TYPESAFE_KEY)('live pipeline', () => {
  it('looks up a company end to end', async () => {
    const { runLookup } = await import('./pipeline');
    const profile: Profile = {
      answers: {
        sells: 'AI support QA software for SaaS companies.',
        icp: 'Series A–C SaaS companies, 50–500 employees, based in the US, with large customer support teams.',
        buyers: 'VP Customer Experience, Head of Support, COO',
      },
      rules: {
        headcount: { min: 50, max: 500 },
        countries: ['United States'],
        checks: ['Series A–C SaaS companies', 'large customer support teams'],
        personas: ['VP Customer Experience', 'Head of Support', 'COO'],
      },
      updatedAt: Date.now(),
    };
    mem.local!.keys = { apollo: APOLLO_KEY, typesafe: TYPESAFE_KEY };
    mem.local!.profile = profile;

    const t0 = performance.now();
    await runLookup(1, LIVE_DOMAIN ?? 'linear.app');
    const ms = Math.round(performance.now() - t0);

    const view = mem.session!.view_1 as ViewState;
    console.log(`\n${ms}ms`, JSON.stringify(view, null, 2));
    expect(view.status).toBe('done');
    if (view.status !== 'done') return;
    expect(view.result.fit?.score).toBeTypeOf('number');
    expect(view.result.contacts?.length).toBeGreaterThan(0);
    expect(view.result.contacts?.every((c) => c.rank !== null)).toBe(true);
    expect(view.result.whyNow).toBeTruthy();
    // Apollo charges 1 for the company and 1 for the job postings page.
    expect(mem.local!.credits).toMatchObject({ company: 1, jobs: 1, reveal: 0 });
  }, 30000);
});
