import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem: Record<string, unknown> = {};
vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: structuredClone(mem[key]) }),
        set: async (items: Record<string, unknown>) => void Object.assign(mem, structuredClone(items)),
      },
      onChanged: { addListener() {}, removeListener() {} },
    },
  },
}));
const store = await import('./storage');

const res = (fit: number) => ({ domain: 'a.com', fetchedAt: Date.now(), company: { name: 'A' }, fit: { score: fit }, persona: null, contacts: [] }) as any;

beforeEach(() => Object.keys(mem).forEach((k) => delete mem[k]));

describe('saved accounts', () => {
  it('re-saving updates the snapshot but keeps the original savedAt', async () => {
    await store.saveAccount(res(50));
    const first = (await store.getSaved())['a.com']!.savedAt;
    await new Promise((r) => setTimeout(r, 5));
    await store.saveAccount(res(90));
    const again = (await store.getSaved())['a.com']!;
    expect(again.fit?.score).toBe(90);
    expect(again.savedAt).toBe(first);
  });

  it('status and note survive unsave/save and refreshes', async () => {
    await store.saveAccount(res(50));
    await store.updateAccountMeta('a.com', { status: 'contacted' });
    await store.updateAccountMeta('a.com', { note: 'Intro via Sam' });
    await store.unsaveAccount('a.com');
    await store.saveAccount(res(70));
    expect((await store.getAccountMeta())['a.com']).toMatchObject({ status: 'contacted', note: 'Intro via Sam' });
  });
});

describe('credit ledger', () => {
  it('does not lose concurrent spends', async () => {
    await Promise.all([store.recordSpend('company'), store.recordSpend('jobs'), store.recordSpend('reveal'), store.recordSpend('company')]);
    expect(await store.getLedger()).toMatchObject({ company: 2, jobs: 1, reveal: 1 });
  });
});
