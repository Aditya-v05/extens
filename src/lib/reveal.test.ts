import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));

// Fake Apollo: tracks how many requests run at once; "nomail" has no email, "gone" isn't found, "boom" errors.
let inFlight = 0;
let maxInFlight = 0;
vi.mock('./apollo', () => ({
  revealPerson: vi.fn(async (_key: string, id: string) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    if (id === 'boom') throw Object.assign(new Error('Apollo 500'), { name: 'Error' });
    if (id === 'gone') return { found: false, lastName: null, email: null, emailStatus: null, linkedin: null, title: null };
    return { found: true, lastName: id.toUpperCase(), email: id === 'nomail' ? null : `${id}@acme.com`, emailStatus: 'verified', linkedin: null, title: null };
  }),
}));

const writes: string[] = [];
let spent = 0;
const contacts = ['a', 'b', 'c', 'd', 'e', 'nomail', 'gone', 'boom'].map((id) => ({
  apolloId: id, firstName: id, lastName: null, lastNameObfuscated: null, title: null, hasEmail: true, rank: 50,
}));
let cached: any;
vi.mock('./storage', () => ({
  getKeys: async () => ({ apollo: 'k', typesafe: 't' }),
  recordSpend: async (_kind: string, n: number) => void (spent += n),
  putReveals: async () => void writes.push('reveals'),
  getCached: async () => cached,
  putCached: async (r: any) => void (writes.push('cache'), (cached = r)),
  getSaved: async () => ({}),
  getBalance: async () => ({ available: false, checkedAt: Date.now() }),
  setBalance: async () => {},
}));

beforeEach(() => {
  writes.length = 0;
  spent = 0;
  maxInFlight = 0;
  cached = { domain: 'acme.com', contacts: structuredClone(contacts) };
});

describe('revealContacts', () => {
  it('reveals in parallel (max 3), charges only found people, and saves each copy once', async () => {
    const { revealContacts } = await import('./pipeline');
    const out = await revealContacts(null, 'acme.com', contacts.map((c) => c.apolloId));

    expect(maxInFlight).toBe(3);
    expect(out).toMatchObject({ revealed: 5, noEmail: 2, failed: 1 }); // "gone" counts as no email; "boom" failed
    expect(out.error?.message).toContain('Apollo 500');
    expect(spent).toBe(6); // a–e and nomail were found; gone and boom weren't charged
    expect(writes).toEqual(['reveals', 'cache']); // one write each, not one per person
    const emails = cached.contacts.map((c: any) => c.email ?? null);
    expect(emails).toEqual(['a@acme.com', 'b@acme.com', 'c@acme.com', 'd@acme.com', 'e@acme.com', null, null, null]);
    expect(cached.contacts.find((c: any) => c.apolloId === 'boom').revealedAt).toBeUndefined(); // can be retried
  });
});
