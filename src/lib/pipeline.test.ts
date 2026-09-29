import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));
// Fake Jev: answers every role question with a probability encoding the role's title number.
const calls: { roles: string[]; questionIds: string[] }[] = [];
vi.mock('./jev', async (orig) => ({
  ...(await orig<typeof import('./jev')>()),
  ask: vi.fn(async (_key: string, state: any, questions: Record<string, unknown>) => {
    const roles: string[] = (state.open_roles ?? []).map((r: any) => r.title);
    calls.push({ roles, questionIds: Object.keys(questions) });
    const answers: Record<string, unknown> = {};
    const site: string[] = (state.website ?? []).map((w: any) => w.text);
    for (const id of Object.keys(questions)) {
      if (id.startsWith('job_')) answers[id] = { type: 'noul', noul: Number(roles[Number(id.slice(4))]!.slice(5)) / 100 };
      else if (id.startsWith('site_type_')) answers[id] = { type: 'choice', choice: site[Number(id.slice(10))], confidence: 1, probabilities: {} };
      else if (id.startsWith('site_rel_')) answers[id] = { type: 'noul', noul: Number(site[Number(id.slice(9))]!.slice(5)) / 100 };
      else if (id === 'timing') answers[id] = { type: 'score', score: 1, confidence: 1, probabilities: {} };
      else answers[id] = { type: 'noul', noul: 0.5 };
    }
    return answers;
  }),
}));

describe('judgeWhyNow', () => {
  it('batches roles by 10 and maps answers back to the right role', async () => {
    const { judgeWhyNow } = await import('./pipeline');
    const jobs = Array.from({ length: 23 }, (_, i) => ({ title: `Role ${i}`, url: null, postedAt: null, daysOpen: i }));
    const signals = [{ kind: 'funding' as const, label: 'x', evidence: [], fact: 'raised' }];

    const answers = await judgeWhyNow('k', { seller: {}, company: {} }, signals, jobs);

    // 1 timing/signals call (no role questions) + 3 role batches of 10, 10, 3.
    expect(calls).toHaveLength(4);
    expect(calls[0]!.questionIds).toEqual(['timing', 'signal_0']);
    expect(calls.slice(1).map((c) => c.roles.length)).toEqual([10, 10, 3]);
    // job_<n> must carry the answer for jobs[n], across batch boundaries.
    for (let n = 0; n < 23; n++) expect(answers[`job_${n}`]).toEqual({ type: 'noul', noul: n / 100 });
    expect(answers.signal_0).toBeDefined();
  });

  it('batches website snippets too and remaps both of their answers', async () => {
    calls.length = 0;
    const { judgeWhyNow } = await import('./pipeline');
    const snippets = Array.from({ length: 12 }, (_, i) => ({ text: `Snip ${i}`, url: 'u', source: 'blog' as const, date: null }));
    const answers = await judgeWhyNow('k', { seller: {}, company: {} }, [], [], snippets);
    expect(calls.map((c) => c.questionIds.length)).toEqual([1, 20, 4]); // timing; 10×(type+rel); 2×(type+rel)
    for (let n = 0; n < 12; n++) {
      expect(answers[`site_type_${n}`]).toMatchObject({ choice: `Snip ${n}` });
      expect(answers[`site_rel_${n}`]).toEqual({ type: 'noul', noul: n / 100 });
    }
  });
});
